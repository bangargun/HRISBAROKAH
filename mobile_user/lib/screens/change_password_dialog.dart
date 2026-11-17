import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// Ganti password akun sendiri. HP lain yang memakai akun ini otomatis keluar.
class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key});

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _old = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;
  bool _busy = false;

  Future<void> _submit() async {
    if (_new.text.length < 6) {
      setState(() => _error = 'Password baru minimal 6 karakter');
      return;
    }
    if (_new.text != _confirm.text) {
      setState(() => _error = 'Konfirmasi password baru tidak sama');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiService.changePassword(_old.text, _new.text);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password berhasil diganti'), backgroundColor: Colors.green),
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
    return AlertDialog(
      title: const Text('Ganti password'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: _old, obscureText: true, decoration: const InputDecoration(labelText: 'Password saat ini')),
            TextField(controller: _new, obscureText: true, decoration: const InputDecoration(labelText: 'Password baru (min. 6 karakter)')),
            TextField(controller: _confirm, obscureText: true, decoration: const InputDecoration(labelText: 'Ulangi password baru')),
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
