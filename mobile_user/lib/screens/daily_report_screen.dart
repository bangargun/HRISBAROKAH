import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

/// Laporan harian cabang untuk kepala cabang: foto tiap item checklist operasional hari ini.
class DailyReportScreen extends StatefulWidget {
  const DailyReportScreen({super.key});

  @override
  State<DailyReportScreen> createState() => _DailyReportScreenState();
}

class _DailyReportScreenState extends State<DailyReportScreen> {
  final _picker = ImagePicker();
  final String _date = DateFormat('yyyy-MM-dd').format(DateTime.now());
  Map<String, dynamic>? _checklist;
  Map<String, Map<String, dynamic>> _photos = {};
  String? _error;
  String? _busyKey;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final results = await Future.wait([ApiService.getDailyChecklist(), ApiService.getDailyReport(_date)]);
      final outlets = results[1]['outlets'] as List<dynamic>;
      final photos = outlets.isEmpty ? <dynamic>[] : outlets.first['photos'] as List<dynamic>;
      if (!mounted) return;
      setState(() {
        _checklist = results[0];
        _photos = {for (final p in photos) p['itemKey'] as String: Map<String, dynamic>.from(p)};
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _capture(Map item) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(children: [
          ListTile(
            leading: const Icon(Icons.photo_camera),
            title: const Text('Ambil foto'),
            onTap: () => Navigator.pop(ctx, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library),
            title: const Text('Pilih dari galeri'),
            onTap: () => Navigator.pop(ctx, ImageSource.gallery),
          ),
        ]),
      ),
    );
    if (source == null) return;
    // Diperkecil agar di bawah batas 2 MB server
    final file = await _picker.pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 80);
    if (file == null || !mounted) return;
    final notes = await _askNotes(item['title'] as String);
    if (notes == null || !mounted) return;

    setState(() => _busyKey = item['key'] as String);
    try {
      final bytes = await file.readAsBytes();
      await ApiService.submitDailyReportPhoto(_date, item['key'] as String, base64Encode(bytes), notes.isEmpty ? null : notes);
      await _load();
      _snack('Foto "${item['title']}" terkirim', Colors.green);
    } catch (e) {
      _snack(e.toString().replaceAll('Exception: ', ''), Colors.red);
    } finally {
      if (mounted) setState(() => _busyKey = null);
    }
  }

  /// Catatan opsional; null bila dibatalkan.
  Future<String?> _askNotes(String title) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: const TextStyle(fontSize: 16)),
        content: TextField(
          controller: controller,
          maxLength: 500,
          decoration: const InputDecoration(hintText: 'Catatan (opsional)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Kirim')),
        ],
      ),
    );
  }

  void _snack(String text, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text), backgroundColor: color));
  }

  @override
  Widget build(BuildContext context) {
    final items = (_checklist?['items'] as List<dynamic>?) ?? [];
    final categories = (_checklist?['categories'] as Map?) ?? {};
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Laporan Harian', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
          : _checklist == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(
                        '${DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(DateTime.now())} · ${_photos.length} dari ${items.length} foto',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(value: items.isEmpty ? 0 : _photos.length / items.length),
                      for (final cat in categories.keys) ...[
                        const SizedBox(height: 16),
                        Text(categories[cat] as String, style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey.shade700)),
                        const SizedBox(height: 6),
                        for (final item in items.where((i) => i['category'] == cat)) _itemCard(item as Map),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _itemCard(Map item) {
    final photo = _photos[item['key']];
    final busy = _busyKey == item['key'];
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: photo != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.network(
                  '${ApiService.backendOrigin}${photo['photoUrl']}',
                  width: 48,
                  height: 48,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const Icon(Icons.image_not_supported),
                ),
              )
            : const Icon(Icons.photo_camera_outlined, size: 32, color: Colors.grey),
        title: Text(item['title'] as String, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        subtitle: Text(
          photo != null
              ? 'Terkirim ${DateFormat('HH:mm').format(DateTime.parse(photo['submittedAt']).toLocal())}'
              : item['targetTime'] as String,
          style: TextStyle(color: photo != null ? Colors.green.shade700 : null),
        ),
        trailing: busy
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
            : Icon(photo != null ? Icons.check_circle : Icons.add_a_photo, color: photo != null ? Colors.green : null),
        onTap: busy ? null : () => _capture(item),
      ),
    );
  }
}
