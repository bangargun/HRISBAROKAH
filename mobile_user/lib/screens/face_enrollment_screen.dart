import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'face_camera_screen.dart';

const _enrollPhotoCount = 3;
const _managerRoles = {'SUPER_ADMIN', 'HR_ADMIN', 'AREA_MANAGER', 'STORE_MANAGER'};
const _deleteRoles = {'SUPER_ADMIN', 'HR_ADMIN'};

bool canManageFaces(String? role) => _managerRoles.contains(role);

/// Pendaftaran wajah karyawan oleh HR / Store Manager.
class FaceEnrollmentScreen extends StatefulWidget {
  const FaceEnrollmentScreen({super.key});

  @override
  State<FaceEnrollmentScreen> createState() => _FaceEnrollmentScreenState();
}

class _FaceEnrollmentScreenState extends State<FaceEnrollmentScreen> {
  bool _isLoading = true;
  String? _error;
  String? _role;
  List<dynamic> _employees = [];
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final user = await ApiService.getCurrentUser();
      _role = user?['role'] as String?;
      // Store Manager hanya melihat karyawan di outletnya
      final outletId = _role == 'STORE_MANAGER' ? user?['profile']?['outletId'] as String? : null;
      final employees = await ApiService.getEmployees(outletId: outletId);
      if (mounted) setState(() => _employees = employees);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _employees;
    return _employees.where((e) {
      final name = (e['fullName'] ?? '').toString().toLowerCase();
      final nik = (e['nik'] ?? '').toString().toLowerCase();
      return name.contains(q) || nik.contains(q);
    }).toList();
  }

  void _showMessage(String text, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: isError ? Colors.red : Colors.green),
    );
  }

  Future<void> _openEmployee(Map<String, dynamic> employee) async {
    Map<String, dynamic> status;
    try {
      status = await ApiService.getFaceStatus(employee['id']);
    } catch (e) {
      _showMessage(e.toString().replaceAll('Exception: ', ''), isError: true);
      return;
    }
    if (!mounted) return;

    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => _EmployeeFaceSheet(
        employee: employee,
        status: status,
        canDelete: _deleteRoles.contains(_role),
      ),
    );
    if (!mounted) return;
    if (action == 'enroll') await _enroll(employee);
    if (action == 'delete') await _delete(employee);
  }

  Future<void> _enroll(Map<String, dynamic> employee) async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (ctx) => _ConsentDialog(name: employee['fullName'] ?? ''),
    );
    if (consent != true || !mounted) return;

    final photos = <String>[];
    for (var i = 1; i <= _enrollPhotoCount; i++) {
      final photo = await FaceCameraScreen.capture(
        context,
        title: 'Foto wajah $i dari $_enrollPhotoCount',
        initialLens: CameraLensDirection.back,
      );
      if (photo == null || !mounted) return;
      photos.add(photo);
    }

    setState(() => _isLoading = true);
    try {
      await ApiService.enrollFace(employee['id'], photos);
      _showMessage('Wajah ${employee['fullName']} berhasil didaftarkan');
    } catch (e) {
      _showMessage(e.toString().replaceAll('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _delete(Map<String, dynamic> employee) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus data wajah?'),
        content: Text(
          'Data wajah ${employee['fullName']} akan dihapus permanen. '
          'Karyawan tidak bisa absen sampai wajahnya didaftarkan lagi.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ApiService.deleteFace(employee['id']);
      _showMessage('Data wajah ${employee['fullName']} sudah dihapus');
    } catch (e) {
      _showMessage(e.toString().replaceAll('Exception: ', ''), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final employees = _filtered;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Daftar Wajah Karyawan'),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Cari nama atau NIK',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _Message(text: _error!, actionLabel: 'Coba lagi', onAction: _load)
                    : employees.isEmpty
                        ? _Message(
                            text: _employees.isEmpty
                                ? 'Belum ada data karyawan. Tambahkan karyawan dulu lewat web admin.'
                                : 'Tidak ada karyawan yang cocok dengan pencarian.',
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              itemCount: employees.length,
                              separatorBuilder: (_, _) => const Divider(height: 1),
                              itemBuilder: (_, i) {
                                final e = employees[i] as Map<String, dynamic>;
                                return ListTile(
                                  leading: const CircleAvatar(child: Icon(Icons.person)),
                                  title: Text(e['fullName'] ?? '-'),
                                  subtitle: Text('${e['nik'] ?? '-'} · ${e['outlet']?['name'] ?? '-'}'),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: () => _openEmployee(e),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _EmployeeFaceSheet extends StatelessWidget {
  final Map<String, dynamic> employee;
  final Map<String, dynamic> status;
  final bool canDelete;

  const _EmployeeFaceSheet({required this.employee, required this.status, required this.canDelete});

  @override
  Widget build(BuildContext context) {
    final enrolled = status['enrolled'] == true;
    final enrolledAt = status['enrolledAt'] != null ? DateTime.tryParse(status['enrolledAt'])?.toLocal() : null;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(employee['fullName'] ?? '-', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('NIK ${employee['nik'] ?? '-'}', style: TextStyle(color: Colors.grey.shade600)),
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(enrolled ? Icons.verified_user : Icons.warning_amber_rounded,
                    color: enrolled ? Colors.green : Colors.orange),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    enrolled
                        ? 'Wajah terdaftar (${status['samples']} foto)'
                            '${enrolledAt != null ? ', ${enrolledAt.day}/${enrolledAt.month}/${enrolledAt.year}' : ''}'
                        : 'Wajah belum terdaftar. Karyawan ini belum bisa absen.',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              icon: const Icon(Icons.face_retouching_natural),
              label: Text(enrolled ? 'Daftarkan Ulang Wajah' : 'Daftarkan Wajah'),
              onPressed: () => Navigator.pop(context, 'enroll'),
            ),
            if (enrolled && canDelete) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Hapus Data Wajah'),
                onPressed: () => Navigator.pop(context, 'delete'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ConsentDialog extends StatefulWidget {
  final String name;
  const _ConsentDialog({required this.name});

  @override
  State<_ConsentDialog> createState() => _ConsentDialogState();
}

class _ConsentDialogState extends State<_ConsentDialog> {
  bool _checked = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Persetujuan data wajah'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Data wajah ${widget.name} hanya dipakai untuk absensi dan dihapus saat karyawan berhenti bekerja. '
            'Ambil $_enrollPhotoCount foto: karyawan menghadap kamera lalu berkedip di setiap foto.',
          ),
          const SizedBox(height: 12),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _checked,
            onChanged: (v) => setState(() => _checked = v ?? false),
            title: const Text('Karyawan sudah menandatangani persetujuan tertulis'),
            controlAffinity: ListTileControlAffinity.leading,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
        FilledButton(
          onPressed: _checked ? () => Navigator.pop(context, true) : null,
          child: const Text('Mulai Foto'),
        ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _Message({required this.text, this.actionLabel, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(text, textAlign: TextAlign.center),
            if (actionLabel != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
