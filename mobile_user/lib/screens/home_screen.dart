import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'kasbon_screen.dart';
import 'requests_screen.dart';
import 'payslip_screen.dart';
import 'daily_report_screen.dart';
import 'survey360_screen.dart';
import 'change_password_dialog.dart';
import 'attendance_pin_dialog.dart';
import 'login_screen.dart';
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

  Widget _tabletNotice(String outletName) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.tablet_mac, color: Colors.blue.shade800),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Absen di tablet cabang $outletName',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.blue.shade900),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final outlet = _attendanceData?['outlet'];
    final att = _attendanceData?['attendance'];
    final outletName = (_attendanceData?['workingOutletName'] ?? outlet?['name'] ?? '').toString();

    final hasClockedIn = att != null && att['clockInTime'] != null;
    final hasClockedOut = att != null && att['clockOutTime'] != null;

    final todayFormatted = DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(DateTime.now());

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: const Text(
          'Barokah Grup',
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
            icon: const Icon(Icons.key),
            tooltip: 'Ganti password',
            onPressed: () => showDialog(context: context, builder: (_) => const ChangePasswordDialog()),
          ),
          IconButton(
            icon: const Icon(Icons.pin_outlined),
            tooltip: 'PIN absen tablet',
            onPressed: () => showDialog(context: context, builder: (_) => const AttendancePinDialog()),
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
                                    ? DateFormat('HH:mm').format(DateTime.parse(att['clockInTime']).toLocal())
                                    : '--:--',
                                hasClockedIn ? Colors.green : Colors.grey,
                              ),
                              const SizedBox(width: 24),
                              _timeBadge(
                                'Pulang',
                                hasClockedOut
                                    ? DateFormat('HH:mm').format(DateTime.parse(att['clockOutTime']).toLocal())
                                    : '--:--',
                                hasClockedOut ? Colors.green : Colors.grey,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    _tabletNotice(outletName),
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
                          icon: Icons.receipt_long_rounded,
                          title: 'Slip Gaji',
                          color: Colors.indigo,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const PayslipScreen()),
                          ),
                        ),
                        _quickMenuCard(
                          icon: Icons.history_rounded,
                          title: 'Riwayat',
                          color: Colors.purple,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const RequestsScreen(initialTab: 1)),
                          ),
                        ),
                        _quickMenuCard(
                          icon: Icons.groups_rounded,
                          title: 'Survei 360°',
                          color: Colors.pink,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const Survey360Screen()),
                          ),
                        ),
                        if (_role == 'STORE_MANAGER')
                          _quickMenuCard(
                            icon: Icons.fact_check_rounded,
                            title: 'Laporan Harian',
                            color: Colors.orange,
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const DailyReportScreen()),
                            ),
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
