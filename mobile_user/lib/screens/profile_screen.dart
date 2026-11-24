import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';

const _ink = Color(0xFF0F172A);
const _genders = ['Laki-laki', 'Perempuan'];
const _statusLabel = {
  'PROBATION': 'Masa percobaan',
  'CONTRACT': 'Kontrak',
  'PERMANENT': 'Tetap',
  'DAILY_WORKER': 'Harian',
  'INTERN': 'Magang',
};

String _err(Object e) => e.toString().replaceAll('Exception: ', '');
String _longDate(String ymd) => DateFormat('d MMMM yyyy', 'id_ID').format(DateTime.parse(ymd));

/// Data diri kru. Data pribadi langsung tersimpan; data kepegawaian hanya bisa diubah HR;
/// rekening gaji baru berlaku setelah disetujui HR.
/// [firstTime]: dibuka otomatis setelah login karena data diri belum lengkap; tidak bisa ditutup sebelum disimpan.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.firstTime = false});
  final bool firstTime;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  String? _birthDate;
  String? _gender;
  Map<String, dynamic>? _profile;
  String? _loadError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    _address.dispose();
    super.dispose();
  }

  void _apply(Map<String, dynamic> p) {
    _profile = p;
    _phone.text = (p['phone'] ?? '') as String;
    _email.text = (p['email'] ?? '') as String;
    _address.text = (p['address'] ?? '') as String;
    _birthDate = p['birthDate'] as String?;
    _gender = _genders.contains(p['gender']) ? p['gender'] as String : null;
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final p = await ApiService.getMyProfile();
      if (mounted) setState(() => _apply(p));
    } catch (e) {
      if (mounted) setState(() => _loadError = _err(e));
    }
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate != null ? DateTime.parse(_birthDate!) : DateTime(now.year - 20),
      firstDate: DateTime(1930),
      lastDate: now.subtract(const Duration(days: 1)),
      helpText: 'Tanggal lahir',
    );
    if (picked != null) setState(() => _birthDate = DateFormat('yyyy-MM-dd').format(picked));
  }

  Future<void> _save() async {
    final valid = _formKey.currentState!.validate();
    if (!valid || _birthDate == null || _gender == null) {
      if (_birthDate == null || _gender == null) {
        _snack('Lengkapi tanggal lahir dan jenis kelamin');
      }
      return;
    }
    setState(() => _saving = true);
    try {
      final p = await ApiService.updateMyProfile({
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'birthDate': _birthDate,
        'gender': _gender,
        'address': _address.text.trim(),
      });
      if (!mounted) return;
      if (widget.firstTime) {
        Navigator.pop(context, true);
        return;
      }
      setState(() => _apply(p));
      _snack('Data diri tersimpan');
    } catch (e) {
      _snack(_err(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _openBankForm() async {
    final updated = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _BankForm(fullName: (_profile?['fullName'] ?? '') as String),
    );
    if (updated != null && mounted) {
      setState(() => _profile = updated);
      _snack('Pengajuan rekening dikirim ke HR');
    }
  }

  Future<void> _cancelBankChange() async {
    try {
      final p = await ApiService.cancelBankChange();
      if (mounted) setState(() => _profile = p);
      _snack('Pengajuan rekening dibatalkan');
    } catch (e) {
      _snack(_err(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    return PopScope(
      canPop: !widget.firstTime,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: Text(widget.firstTime ? 'Lengkapi data diri' : 'Data Diri',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          automaticallyImplyLeading: !widget.firstTime,
          backgroundColor: _ink,
          foregroundColor: Colors.white,
        ),
        body: p == null
            ? Center(
                child: _loadError == null
                    ? const CircularProgressIndicator()
                    : Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Text(_loadError!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          OutlinedButton(onPressed: _load, child: const Text('Coba lagi')),
                        ]),
                      ),
              )
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (widget.firstTime)
                      _note('Sebelum memakai aplikasi, lengkapi data dirimu. Data ini dipakai HR untuk administrasi kepegawaian.'),
                    _section('Data kepegawaian', [
                      _readOnly('Nama', p['fullName']),
                      _readOnly('NIK', p['nik']),
                      _readOnly('Cabang', p['outlet']),
                      _readOnly('Jabatan', p['position']),
                      _readOnly('Status', _statusLabel[p['status']] ?? p['status']),
                      _readOnly('Tanggal masuk', _longDate(p['joinDate'] as String)),
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text('Data ini hanya bisa diubah HR. Hubungi HR bila ada yang salah.',
                            style: TextStyle(fontSize: 12, color: Colors.black54)),
                      ),
                    ]),
                    _section('Data pribadi', [
                      TextFormField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        maxLength: 20,
                        decoration: const InputDecoration(labelText: 'Nomor HP', counterText: ''),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Nomor HP wajib diisi' : null,
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: _pickBirthDate,
                        child: InputDecorator(
                          decoration: const InputDecoration(labelText: 'Tanggal lahir', suffixIcon: Icon(Icons.calendar_today, size: 18)),
                          child: Text(_birthDate == null ? 'Pilih tanggal' : _longDate(_birthDate!)),
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text('Jenis kelamin', style: TextStyle(fontSize: 12, color: Colors.black54)),
                      const SizedBox(height: 6),
                      SegmentedButton<String>(
                        segments: [for (final g in _genders) ButtonSegment(value: g, label: Text(g))],
                        selected: {?_gender},
                        emptySelectionAllowed: true,
                        showSelectedIcon: false,
                        onSelectionChanged: (s) => setState(() => _gender = s.isEmpty ? null : s.first),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _address,
                        maxLines: 3,
                        maxLength: 300,
                        decoration: const InputDecoration(labelText: 'Alamat tinggal sekarang'),
                        validator: (v) => (v == null || v.trim().length < 5) ? 'Isi alamat lengkap' : null,
                      ),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email (boleh kosong)'),
                        validator: (v) {
                          final t = (v ?? '').trim();
                          if (t.isEmpty) return null;
                          return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(t) ? null : 'Format email tidak valid';
                        },
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _saving ? null : _save,
                          style: FilledButton.styleFrom(backgroundColor: _ink, padding: const EdgeInsets.symmetric(vertical: 14)),
                          child: Text(_saving ? 'Menyimpan…' : 'Simpan data diri'),
                        ),
                      ),
                    ]),
                    if (!widget.firstTime) _bankSection(p),
                    if (!widget.firstTime) const TelegramSection(),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _bankSection(Map<String, dynamic> p) {
    final bank = p['bank'] as Map<String, dynamic>;
    final change = p['bankChange'] as Map<String, dynamic>?;
    final pending = change != null && change['status'] == 'PENDING';
    final rejected = change != null && change['status'] == 'REJECTED';
    return _section('Rekening gaji', [
      if (bank['bankAccountNumber'] == null)
        const Text('Belum ada rekening. Gaji belum bisa ditransfer sebelum rekening disetujui HR.')
      else ...[
        _readOnly('Bank', bank['bankName']),
        _readOnly('Nomor', bank['bankAccountNumber']),
        _readOnly('Atas nama', bank['bankAccountHolder']),
      ],
      if (pending) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.amber.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.amber.shade200),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Menunggu persetujuan HR', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('${change['bankName']} · ${change['bankAccountNumber']} a.n. ${change['bankAccountHolder']}'),
            const SizedBox(height: 4),
            const Text('Sampai disetujui, gaji tetap dikirim ke rekening di atas.', style: TextStyle(fontSize: 12)),
            TextButton(onPressed: _cancelBankChange, child: const Text('Batalkan pengajuan')),
          ]),
        ),
      ],
      if (rejected) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.red.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.red.shade200),
          ),
          child: Text('Pengajuan rekening ${change['bankAccountNumber']} ditolak HR: ${change['note'] ?? '-'}'),
        ),
      ],
      const SizedBox(height: 12),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: _openBankForm,
          icon: const Icon(Icons.account_balance),
          label: Text(pending ? 'Ubah pengajuan rekening' : 'Ajukan rekening baru'),
        ),
      ),
    ]);
  }

  Widget _note(String text) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.blue.shade200),
        ),
        child: Text(text),
      );

  Widget _section(String title, List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 10),
          ...children,
        ]),
      );

  Widget _readOnly(String label, Object? value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: Colors.black54))),
          Expanded(child: Text('${value ?? '-'}', style: const TextStyle(fontWeight: FontWeight.w600))),
        ]),
      );
}

/// Form pengajuan rekening baru; mengembalikan data diri terbaru bila terkirim.
class _BankForm extends StatefulWidget {
  const _BankForm({required this.fullName});
  final String fullName;

  @override
  State<_BankForm> createState() => _BankFormState();
}

class _BankFormState extends State<_BankForm> {
  final _formKey = GlobalKey<FormState>();
  final _bank = TextEditingController();
  final _number = TextEditingController();
  late final _holder = TextEditingController(text: widget.fullName);
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _bank.dispose();
    _number.dispose();
    _holder.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final p = await ApiService.requestBankChange({
        'bankName': _bank.text.trim(),
        'bankAccountNumber': _number.text.replaceAll(RegExp(r'[\s.-]'), ''),
        'bankAccountHolder': _holder.text.trim(),
      });
      if (mounted) Navigator.pop(context, p);
    } catch (e) {
      if (mounted) setState(() => _error = _err(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Rekening gaji baru', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Rekening harus atas nama sendiri. Berlaku setelah disetujui HR.', style: TextStyle(fontSize: 12)),
          const SizedBox(height: 12),
          TextFormField(
            controller: _bank,
            maxLength: 60,
            decoration: const InputDecoration(labelText: 'Nama bank', hintText: 'BCA, BRI, Mandiri…', counterText: ''),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Isi nama bank' : null,
          ),
          TextFormField(
            controller: _number,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Nomor rekening'),
            validator: (v) =>
                RegExp(r'^\d{5,30}$').hasMatch((v ?? '').replaceAll(RegExp(r'[\s.-]'), '')) ? null : 'Nomor rekening 5-30 digit angka',
          ),
          TextFormField(
            controller: _holder,
            maxLength: 100,
            decoration: const InputDecoration(labelText: 'Nama pemilik rekening', counterText: ''),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Isi nama pemilik rekening' : null,
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: _ink, padding: const EdgeInsets.symmetric(vertical: 14)),
              child: Text(_busy ? 'Mengirim…' : 'Kirim ke HR'),
            ),
          ),
        ]),
      ),
    );
  }
}

/// Hubungkan Telegram: notifikasi hasil pengajuan (dan pengajuan yang menunggu, untuk Kepala Cabang).
class TelegramSection extends StatefulWidget {
  const TelegramSection({super.key});

  @override
  State<TelegramSection> createState() => _TelegramSectionState();
}

class _TelegramSectionState extends State<TelegramSection> {
  Map<String, dynamic>? _status;
  bool _busy = false;
  bool _waiting = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final s = await ApiService.getTelegramStatus();
      if (mounted) setState(() => _status = s);
    } catch (_) {
      // Status Telegram tidak penting untuk sisa layar
    }
  }

  Future<void> _connect() async {
    setState(() => _busy = true);
    try {
      final url = await ApiService.createTelegramLink();
      if (url == null) throw Exception('Bot Telegram belum siap. Coba lagi sebentar.');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      _startPolling();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_err(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _startPolling() {
    _poll?.cancel();
    final started = DateTime.now();
    setState(() => _waiting = true);
    _poll = Timer.periodic(const Duration(seconds: 3), (t) async {
      await _load();
      final done = _status?['linked'] == true || DateTime.now().difference(started).inMinutes >= 2;
      if (done) {
        t.cancel();
        if (mounted) setState(() => _waiting = false);
      }
    });
  }

  Future<void> _disconnect() async {
    setState(() => _busy = true);
    try {
      final s = await ApiService.unlinkTelegram();
      if (mounted) setState(() => _status = s);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_err(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _status;
    if (s == null || s['available'] != true) return const SizedBox.shrink();
    final linked = s['linked'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Notifikasi Telegram', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 6),
        Text(
          linked
              ? 'Terhubung${s['telegramUsername'] != null ? ' ke @${s['telegramUsername']}' : ''}. Hasil pengajuanmu dikirim ke Telegram.'
              : _waiting
                  ? 'Di Telegram, tekan Start pada bot HRIS. Status di sini berubah otomatis.'
                  : 'Dapatkan pemberitahuan di Telegram saat pengajuanmu disetujui atau ditolak.',
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: linked
              ? OutlinedButton(onPressed: _busy ? null : _disconnect, child: const Text('Putuskan'))
              : FilledButton.icon(
                  onPressed: _busy ? null : _connect,
                  style: FilledButton.styleFrom(backgroundColor: _ink),
                  icon: const Icon(Icons.send),
                  label: Text(_waiting ? 'Menunggu Telegram…' : 'Hubungkan Telegram'),
                ),
        ),
      ]),
    );
  }
}
