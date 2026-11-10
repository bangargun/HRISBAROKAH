import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'kasbon_screen.dart';
import 'requests_screen.dart';
import 'login_screen.dart';
import 'face_camera_screen.dart';
import 'face_enrollment_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _attendanceData;
  String _currentTime = '';
  Timer? _timer;
  String? _role;

  @override
  void initState() {
    super.initState();
    _startClock();
    _loadTodayAttendance();
    ApiService.getCurrentUser().then((user) {
      if (mounted) setState(() => _role = user?['role'] as String?);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startClock() {
    _updateTime();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _updateTime());
  }

  void _updateTime() {
    final now = DateTime.now();
    setState(() {
      _currentTime = DateFormat('HH:mm:ss').format(now);
    });
  }

  Future<void> _loadTodayAttendance() async {
    setState(() => _isLoading = true);
    try {
      final data = await ApiService.getTodayAttendance();
      setState(() {
        _attendanceData = data;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // Lokasi hanya dicatat sebagai info, absen tetap jalan tanpa GPS
  Future<Position?> _tryGetPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 10));
    } catch (_) {
      return null;
    }
  }

  Future<void> _handleClockIn() async {
    try {
      setState(() => _isLoading = true);
      final photo = await FaceCameraScreen.capture(context, title: 'Selfie Absen Masuk');
      if (photo == null) return;
      final pos = await _tryGetPosition();

      await ApiService.clockIn(
        lat: pos?.latitude,
        lng: pos?.longitude,
        photoBase64: photo,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Berhasil Clock In!'),
            backgroundColor: Colors.green,
          ),
        );
        _loadTodayAttendance();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleClockOut() async {
    try {
      setState(() => _isLoading = true);
      final photo = await FaceCameraScreen.capture(context, title: 'Selfie Absen Pulang');
      if (photo == null) return;
      final pos = await _tryGetPosition();

      await ApiService.clockOut(
        lat: pos?.latitude,
        lng: pos?.longitude,
        photoBase64: photo,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Berhasil Clock Out! Terima kasih!'),
            backgroundColor: Colors.green,
          ),
        );
        _loadTodayAttendance();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleStartBreak() async {
    try {
      setState(() => _isLoading = true);
      await ApiService.startBreak();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sesi istirahat dimulai. Maksimal 60 menit!'),
            backgroundColor: Colors.orange,
          ),
        );
        _loadTodayAttendance();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleEndBreak() async {
    try {
      setState(() => _isLoading = true);
      final res = await ApiService.endBreak();
      if (mounted) {
        final isOver = res['isOverLimit'] == true;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isOver
                ? 'Istirahat selesai! Peringatan: Melebihi batas (${res['totalMinutes']} menit)'
                : 'Istirahat selesai (${res['totalMinutes']} menit). Selamat kembali bertugas!',
            ),
            backgroundColor: isOver ? Colors.deepOrange : Colors.green,
          ),
        );
        _loadTodayAttendance();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final outlet = _attendanceData?['outlet'];
    final att = _attendanceData?['attendance'];
    final isOnBreak = _attendanceData?['isOnBreak'] == true;

    final hasClockedIn = att != null && att['clockInTime'] != null;
    final hasClockedOut = att != null && att['clockOutTime'] != null;

    final todayFormatted = DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(DateTime.now());

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: const Text(
          'Resto Nusantara Staff',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadTodayAttendance,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final nav = Navigator.of(context);
              await ApiService.clearSession();
              if (mounted) {
                nav.pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadTodayAttendance,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Outlet & Lokasi Info Card
                    Card(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 1,
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.storefront_rounded, color: Colors.blueAccent),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    outlet != null ? outlet['name'] : 'Outlet Tidak Ditentukan',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.purple.shade50,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.purple.shade200),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.face_retouching_natural_rounded, size: 13, color: Colors.purple.shade800),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Verifikasi Wajah AI',
                                        style: TextStyle(fontSize: 11, color: Colors.purple.shade800, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              outlet != null ? outlet['address'] : '-',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Clock Digital & Tanggal Card
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        children: [
                          Text(
                            todayFormatted,
                            style: const TextStyle(color: Colors.white70, fontSize: 13),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _currentTime,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 38,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _timeBadge(
                                'Masuk',
                                hasClockedIn
                                    ? DateFormat('HH:mm').format(DateTime.parse(att['clockInTime']))
                                    : '--:--',
                                hasClockedIn ? Colors.green : Colors.grey,
                              ),
                              const SizedBox(width: 24),
                              _timeBadge(
                                'Pulang',
                                hasClockedOut
                                    ? DateFormat('HH:mm').format(DateTime.parse(att['clockOutTime']))
                                    : '--:--',
                                hasClockedOut ? Colors.green : Colors.grey,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Tombol Presensi
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            icon: const Icon(Icons.login),
                            label: const Text('Clock In'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.teal,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: (hasClockedIn || _isLoading) ? null : _handleClockIn,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            icon: const Icon(Icons.logout),
                            label: const Text('Clock Out'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.deepOrange,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: (!hasClockedIn || hasClockedOut || _isLoading) ? null : _handleClockOut,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Modul Istirahat (Break Tracker) Card
                    Card(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      color: isOnBreak ? Colors.amber.shade50 : Colors.white,
                      elevation: 1,
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.coffee_rounded,
                                  color: isOnBreak ? Colors.amber.shade900 : Colors.brown,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Jadwal Istirahat Kerja',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                    color: isOnBreak ? Colors.amber.shade900 : Colors.black87,
                                  ),
                                ),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: isOnBreak ? Colors.amber.shade200 : Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    isOnBreak ? 'Sedang Istirahat' : 'Aktif Bekerja',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: isOnBreak ? Colors.amber.shade900 : Colors.grey.shade700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              isOnBreak
                                  ? 'Harap kembali bekerja sebelum 60 menit berakhir agar tidak tercatat over-break.'
                                  : 'Gunakan fitur ini saat pergantian shift makan siang atau jeda sore.',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                            ),
                            const SizedBox(height: 14),
                            SizedBox(
                              width: double.infinity,
                              child: isOnBreak
                                  ? ElevatedButton.icon(
                                      icon: const Icon(Icons.check_circle_outline),
                                      label: const Text('Selesai Istirahat & Kembali Bekerja'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.amber.shade800,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                      onPressed: _isLoading ? null : _handleEndBreak,
                                    )
                                  : OutlinedButton.icon(
                                      icon: const Icon(Icons.coffee),
                                      label: const Text('Mulai Waktu Istirahat'),
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                      onPressed: (!hasClockedIn || hasClockedOut || _isLoading)
                                          ? null
                                          : _handleStartBreak,
                                    ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Quick Action Menu F&B
                    const Text(
                      'Layanan Karyawan & SDM',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      children: [
                        _quickMenuCard(
                          icon: Icons.payments_rounded,
                          title: 'Kasbon',
                          color: Colors.green,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const KasbonScreen()),
                          ),
                        ),
                        _quickMenuCard(
                          icon: Icons.event_note_rounded,
                          title: 'Cuti & Izin',
                          color: Colors.blue,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const RequestsScreen()),
                          ),
                        ),
                        _quickMenuCard(
                          icon: Icons.swap_horiz_rounded,
                          title: 'Tukar Shift',
                          color: Colors.purple,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const RequestsScreen(initialTab: 1)),
                          ),
                        ),
                        _quickMenuCard(
                          icon: Icons.receipt_long_rounded,
                          title: 'Slip Gaji',
                          color: Colors.indigo,
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Slip Gaji periode aktif akan dirilis tanggal 25')),
                            );
                          },
                        ),
                        _quickMenuCard(
                          icon: Icons.menu_book_rounded,
                          title: 'SOP Resto',
                          color: Colors.orange,
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Pustaka SOP Restoran siap diakses')),
                            );
                          },
                        ),
                        if (canManageFaces(_role))
                          _quickMenuCard(
                            icon: Icons.face_retouching_natural,
                            title: 'Daftar Wajah',
                            color: Colors.teal,
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const FaceEnrollmentScreen()),
                            ),
                          ),
                        _quickMenuCard(
                          icon: Icons.psychology_rounded,
                          title: 'Asesmen SDM',
                          color: Colors.pink,
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Modul DISC & Survey 360 segera hadir')),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _timeBadge(String title, String time, Color color) {
    return Column(
      children: [
        Text(title, style: const TextStyle(color: Colors.white70, fontSize: 11)),
        const SizedBox(height: 2),
        Row(
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(
              time,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ],
        ),
      ],
    );
  }

  Widget _quickMenuCard({
    required IconData icon,
    required String title,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}
