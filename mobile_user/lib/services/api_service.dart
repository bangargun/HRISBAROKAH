import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Gunakan 10.0.2.2 untuk Android emulator, localhost untuk desktop/web, atau IP LAN fisik
  static const String baseUrl = 'http://10.0.2.2:3000/api/v1';

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
  static Future<Map<String, dynamic>> clockIn({
    double? lat,
    double? lng,
    required String photoBase64,
    String? notes,
  }) async {
    final url = Uri.parse('$baseUrl/attendance/clock-in');
    final response = await http.post(
      url,
      headers: await _headers(),
      body: jsonEncode({
        'latitude': ?lat,
        'longitude': ?lng,
        'photoBase64': photoBase64,
        'notes': ?notes,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw Exception(_errorMessage(data, 'Gagal Clock-In'));
    }
  }

  // Attendance: Clock-Out
  static Future<Map<String, dynamic>> clockOut({
    double? lat,
    double? lng,
    required String photoBase64,
    String? notes,
  }) async {
    final url = Uri.parse('$baseUrl/attendance/clock-out');
    final response = await http.post(
      url,
      headers: await _headers(),
      body: jsonEncode({
        'latitude': ?lat,
        'longitude': ?lng,
        'photoBase64': photoBase64,
        'notes': ?notes,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw Exception(_errorMessage(data, 'Gagal Clock-Out'));
    }
  }

  // Attendance Break: Mulai Istirahat
  static Future<Map<String, dynamic>> startBreak() async {
    final url = Uri.parse('$baseUrl/attendance/break/start');
    final response = await http.post(url, headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Gagal memulai istirahat');
    }
  }

  // Attendance Break: Selesai Istirahat
  static Future<Map<String, dynamic>> endBreak() async {
    final url = Uri.parse('$baseUrl/attendance/break/end');
    final response = await http.post(url, headers: await _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Gagal mengakhiri istirahat');
    }
  }

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
