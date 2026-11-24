import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Alamat backend: --dart-define=API_URL=http://192.168.x.x:3000/api/v1 untuk HP fisik.
  // Tanpa itu: emulator Android memakai 10.0.2.2 (= komputer ini), lainnya localhost.
  static const String _configuredUrl = String.fromEnvironment('API_URL');
  static String get baseUrl {
    if (_configuredUrl.isNotEmpty) return _configuredUrl;
    final isAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
    return isAndroid ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', token);
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('user_data');
  }

  static String get backendOrigin => baseUrl.replaceFirst(RegExp(r'/api/v1/?$'), '');

  static Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // Auth: Login
  static Future<Map<String, dynamic>> login(String username, String password) async {
    final url = Uri.parse('$baseUrl/auth/login');
    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      await saveToken(data['accessToken']);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_data', jsonEncode(data['user']));
      return data;
    } else {
      throw Exception(data['message'] ?? 'Gagal masuk');
    }
  }

  // Attendance: Status Hari Ini
  static Future<Map<String, dynamic>> getTodayAttendance() async {
    final url = Uri.parse('$baseUrl/attendance/today');
    final response = await http.get(url, headers: await _headers());
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Gagal memuat status absensi hari ini');
    }
  }

  // Attendance: Clock-In
  // Attendance: Clock-Out
  // Attendance Break: Mulai Istirahat
  // Attendance Break: Selesai Istirahat
  // Requests: Ajukan Kasbon
  static Future<Map<String, dynamic>> submitKasbon({
    required double amount,
    required int tenorMonths,
    required String reason,
  }) async {
    final url = Uri.parse('$baseUrl/requests/kasbon');
    final response = await http.post(
      url,
      headers: await _headers(),
      body: jsonEncode({
        'amount': amount,
        'tenorMonths': tenorMonths,
        'reason': reason,
      }),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Gagal mengajukan kasbon');
    }
  }

  // Requests: Ajukan Cuti/Sakit
  static Future<Map<String, dynamic>> submitGeneralRequest({
    required String type,
    String? startDate,
    String? endDate,
    required String reason,
    String? attachmentUrl,
  }) async {
    final url = Uri.parse('$baseUrl/requests/general');
    final response = await http.post(
      url,
      headers: await _headers(),
      body: jsonEncode({
        'type': type,
        'startDate': startDate,
        'endDate': endDate,
        'reason': reason,
        'attachmentUrl': attachmentUrl,
      }),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Gagal mengirim pengajuan');
    }
  }

  // Requests: Riwayat Pengajuan Saya
  static Future<List<dynamic>> getMyRequests() async {
    final url = Uri.parse('$baseUrl/requests/my');
    final response = await http.get(url, headers: await _headers());
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Gagal memuat riwayat pengajuan');
    }
  }

  // Slip gaji saya (hanya periode yang sudah difinalkan HR)
  static Future<List<dynamic>> getMyPayslips() async {
    final url = Uri.parse('$baseUrl/payroll/my');
    final response = await http.get(url, headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data as List<dynamic>;
    throw Exception(_errorMessage(data, 'Gagal memuat slip gaji'));
  }

  // Pelatihan (milik kru sendiri): modul, kuis mingguan, jadwal sesi
  static Future<List<dynamic>> getTrainingList(String kind) async {
    final response = await http.get(Uri.parse('$baseUrl/training/my/$kind'), headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data as List<dynamic>;
    throw Exception(_errorMessage(data, 'Gagal memuat pelatihan'));
  }

  static Future<Map<String, dynamic>> getTrainingItem(String kind, String id) async {
    final response = await http.get(Uri.parse('$baseUrl/training/my/$kind/$id'), headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data as Map<String, dynamic>;
    throw Exception(_errorMessage(data, 'Gagal memuat pelatihan'));
  }

  static Future<Map<String, dynamic>> submitTrainingAnswers(String kind, String id, List<int> answers) async {
    final response = await http.post(
      Uri.parse('$baseUrl/training/my/$kind/$id/attempts'),
      headers: await _headers(),
      body: jsonEncode({'answers': answers}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) return data as Map<String, dynamic>;
    throw Exception(_errorMessage(data, 'Jawaban gagal dikirim'));
  }

  // Laporan harian cabang: daftar item checklist
  static Future<Map<String, dynamic>> getDailyChecklist() async {
    final response = await http.get(Uri.parse('$baseUrl/daily-reports/checklist'), headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(_errorMessage(data, 'Gagal memuat daftar laporan'));
  }

  // Laporan harian cabang untuk satu tanggal (kepala cabang: cabangnya sendiri)
  static Future<Map<String, dynamic>> getDailyReport(String date) async {
    final url = Uri.parse('$baseUrl/daily-reports').replace(queryParameters: {'date': date});
    final response = await http.get(url, headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(_errorMessage(data, 'Gagal memuat laporan harian'));
  }

  // Kirim / ganti foto satu item laporan harian
  static Future<void> submitDailyReportPhoto(String date, String itemKey, String photoBase64, String? notes) async {
    final response = await http.put(
      Uri.parse('$baseUrl/daily-reports/$date/$itemKey'),
      headers: await _headers(),
      body: jsonEncode({'photoBase64': photoBase64, 'notes': ?notes}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorMessage(jsonDecode(response.body), 'Gagal mengirim foto'));
    }
  }

  // Survei 360°: pertanyaan, jendela & rekan yang bisa dinilai, kirim penilaian
  static Future<List<dynamic>> getSurveyQuestions() async {
    final response = await http.get(Uri.parse('$baseUrl/survey360/questions'), headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data as List<dynamic>;
    throw Exception(_errorMessage(data, 'Gagal memuat pertanyaan survei'));
  }

  static Future<Map<String, dynamic>> getMySurvey() async {
    final response = await http.get(Uri.parse('$baseUrl/survey360/mine'), headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data;
    throw Exception(_errorMessage(data, 'Gagal memuat survei'));
  }

  static Future<void> submitSurvey(String targetId, List<int> answers, String? comment) async {
    final response = await http.post(
      Uri.parse('$baseUrl/survey360'),
      headers: await _headers(),
      body: jsonEncode({'targetId': targetId, 'answers': answers, 'comment': ?comment}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(_errorMessage(jsonDecode(response.body), 'Gagal mengirim penilaian'));
    }
  }

  // Ganti password sendiri; token baru disimpan agar tetap masuk di HP ini
  static Future<void> changePassword(String oldPassword, String newPassword) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/change-password'),
      headers: await _headers(),
      body: jsonEncode({'oldPassword': oldPassword, 'newPassword': newPassword}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(_errorMessage(data, 'Gagal mengganti password'));
    }
    await saveToken(data['accessToken'] as String);
  }

  // PIN absen tablet (6 digit); wajib konfirmasi password akun
  static Future<void> setAttendancePin(String pin, String password) async {
    final response = await http.put(
      Uri.parse('$baseUrl/me/attendance-pin'),
      headers: await _headers(),
      body: jsonEncode({'pin': pin, 'password': password}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(_errorMessage(jsonDecode(response.body), 'Gagal menyimpan PIN absen'));
    }
  }

  // Data diri sendiri: data pribadi langsung tersimpan, rekening baru menunggu HR
  static Future<Map<String, dynamic>> _profileCall(String method, String path, [Map<String, dynamic>? body]) async {
    final url = Uri.parse('$baseUrl/me/profile$path');
    final headers = await _headers();
    final encoded = body == null ? null : jsonEncode(body);
    final response = switch (method) {
      'PUT' => await http.put(url, headers: headers, body: encoded),
      'POST' => await http.post(url, headers: headers, body: encoded),
      'DELETE' => await http.delete(url, headers: headers),
      _ => await http.get(url, headers: headers),
    };
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) return data as Map<String, dynamic>;
    throw Exception(_errorMessage(data, method == 'GET' ? 'Gagal memuat data diri' : 'Gagal menyimpan'));
  }

  static Future<Map<String, dynamic>> getMyProfile() => _profileCall('GET', '');
  static Future<Map<String, dynamic>> updateMyProfile(Map<String, dynamic> body) => _profileCall('PUT', '', body);
  static Future<Map<String, dynamic>> requestBankChange(Map<String, dynamic> body) =>
      _profileCall('POST', '/bank-change', body);
  static Future<Map<String, dynamic>> cancelBankChange() => _profileCall('DELETE', '/bank-change');

  // Notifikasi Telegram akun sendiri
  static Future<Map<String, dynamic>> _telegramCall(String method, [String path = '']) async {
    final url = Uri.parse('$baseUrl/me/telegram$path');
    final headers = await _headers();
    final response = switch (method) {
      'POST' => await http.post(url, headers: headers),
      'DELETE' => await http.delete(url, headers: headers),
      _ => await http.get(url, headers: headers),
    };
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) return data as Map<String, dynamic>;
    throw Exception(_errorMessage(data, 'Gagal menghubungi server'));
  }

  static Future<Map<String, dynamic>> getTelegramStatus() => _telegramCall('GET');
  static Future<String?> createTelegramLink() async => (await _telegramCall('POST', '/link'))['url'] as String?;
  static Future<Map<String, dynamic>> unlinkTelegram() => _telegramCall('DELETE');

  // Data user yang login (disimpan saat login)
  static Future<Map<String, dynamic>?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('user_data');
    return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
  }

  // Pesan error dari backend bisa berupa teks atau daftar (validasi)
  static String _errorMessage(dynamic data, String fallback) {
    final message = data is Map ? data['message'] : null;
    if (message is List) return message.join('\n');
    if (message is String) return message;
    return fallback;
  }

  // Karyawan: Daftar karyawan (untuk HR / Store Manager)
  static Future<List<dynamic>> getEmployees({String? outletId}) async {
    final url = Uri.parse('$baseUrl/employees').replace(
      queryParameters: outletId == null ? null : {'outletId': outletId},
    );
    final response = await http.get(url, headers: await _headers());
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Gagal memuat daftar karyawan');
    }
  }

  // Wajah: Status pendaftaran wajah karyawan
  static Future<Map<String, dynamic>> getFaceStatus(String employeeId) async {
    final url = Uri.parse('$baseUrl/face/employees/$employeeId');
    final response = await http.get(url, headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data;
    } else {
      throw Exception(_errorMessage(data, 'Gagal memuat status wajah'));
    }
  }

  // Wajah: Daftarkan wajah karyawan (3-5 foto)
  static Future<Map<String, dynamic>> enrollFace(String employeeId, List<String> photosBase64) async {
    final url = Uri.parse('$baseUrl/face/employees/$employeeId');
    final response = await http.post(
      url,
      headers: await _headers(),
      body: jsonEncode({'photosBase64': photosBase64, 'consentConfirmed': true}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw Exception(_errorMessage(data, 'Gagal mendaftarkan wajah'));
    }
  }

  // Wajah: Hapus data wajah karyawan (hanya HR)
  static Future<void> deleteFace(String employeeId) async {
    final url = Uri.parse('$baseUrl/face/employees/$employeeId');
    final response = await http.delete(url, headers: await _headers());
    if (response.statusCode != 200) {
      throw Exception(_errorMessage(jsonDecode(response.body), 'Gagal menghapus data wajah'));
    }
  }
}
