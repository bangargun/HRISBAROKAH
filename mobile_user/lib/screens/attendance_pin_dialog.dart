import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';

/// Atur PIN 6 digit untuk absen di tablet cabang.
class AttendancePinDialog extends StatefulWidget {
  const AttendancePinDialog({super.key});

  @override
  State<AttendancePinDialog> createState() => _AttendancePinDialogState();
}

class _AttendancePinDialogState extends State<AttendancePinDialog> {
  final _pin = TextEditingController();
  final _confirm = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _pin.dispose();
    _confirm.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!RegExp(r'^\d{6}$').hasMatch(_pin.text)) {
      setState(() => _error = 'PIN harus 6 digit angka');
      return;
    }
    if (_pin.text != _confirm.text) {
      setState(() => _error = 'Ulangi PIN tidak sama');
      return;
    }
    if (_password.text.isEmpty) {
      setState(() => _error = 'Password akun wajib diisi');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiService.setAttendancePin(_pin.text, _password.text);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PIN absen berhasil disimpan'), backgroundColor: Colors.green),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final digits = [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)];
    return AlertDialog(
      title: const Text('PIN absen tablet'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'PIN dipakai untuk absen di tablet cabang jika wajah tidak dikenali.',
              style: TextStyle(fontSize: 13),
            ),
            TextField(
              controller: _pin,
              obscureText: true,
              keyboardType: TextInputType.number,
              inputFormatters: digits,
              decoration: const InputDecoration(labelText: 'PIN (6 digit)'),
            ),
            TextField(
              controller: _confirm,
              obscureText: true,
              keyboardType: TextInputType.number,
              inputFormatters: digits,
              decoration: const InputDecoration(labelText: 'Ulangi PIN'),
            ),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password akun'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Batal')),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Simpan'),
        ),
      ],
    );
  }
}
