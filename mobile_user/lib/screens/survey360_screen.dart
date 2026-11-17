import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

/// Survei 360°: menilai sikap kerja rekan satu cabang, sekali per rekan per periode gaji.
class Survey360Screen extends StatefulWidget {
  const Survey360Screen({super.key});

  @override
  State<Survey360Screen> createState() => _Survey360ScreenState();
}

class _Survey360ScreenState extends State<Survey360Screen> {
  Map<String, dynamic>? _survey;
  List<dynamic> _questions = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final results = await Future.wait([ApiService.getMySurvey(), ApiService.getSurveyQuestions()]);
      if (!mounted) return;
      setState(() {
        _survey = results[0] as Map<String, dynamic>;
        _questions = results[1] as List<dynamic>;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    }
  }

  String _fmt(String ymd) => DateFormat('d MMM', 'id_ID').format(DateTime.parse(ymd));

  @override
  Widget build(BuildContext context) {
    final survey = _survey;
    final targets = (survey?['targets'] as List<dynamic>?) ?? [];
    final open = survey?['open'] == true;
    final done = targets.where((t) => t['done'] == true).length;
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Survei 360°', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
          : survey == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        color: open ? Colors.green.shade50 : Colors.orange.shade50,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(
                            open
                                ? 'Survei dibuka sampai ${_fmt(survey['to'])}. Sudah menilai $done dari ${targets.length} rekan. Penilaian Anda anonim.'
                                : 'Survei periode ini dibuka ${_fmt(survey['from'])} – ${_fmt(survey['to'])}.',
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      for (final t in targets)
                        Card(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: ListTile(
                            title: Text(t['fullName'] ?? '-', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(t['position']?['title'] ?? ''),
                            trailing: t['done'] == true
                                ? const Icon(Icons.check_circle, color: Colors.green)
                                : Icon(Icons.chevron_right, color: open ? null : Colors.grey),
                            onTap: !open || t['done'] == true
                                ? null
                                : () async {
                                    final sent = await Navigator.push<bool>(
                                      context,
                                      MaterialPageRoute(builder: (_) => _SurveyForm(target: t as Map, questions: _questions)),
                                    );
                                    if (sent == true) _load();
                                  },
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}

class _SurveyForm extends StatefulWidget {
  final Map target;
  final List<dynamic> questions;
  const _SurveyForm({required this.target, required this.questions});

  @override
  State<_SurveyForm> createState() => _SurveyFormState();
}

class _SurveyFormState extends State<_SurveyForm> {
  late final List<int?> _answers = List.filled(widget.questions.length, null);
  final _comment = TextEditingController();
  bool _sending = false;

  Future<void> _send() async {
    if (_answers.contains(null)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Jawab semua pertanyaan terlebih dahulu')));
      return;
    }
    setState(() => _sending = true);
    try {
      final comment = _comment.text.trim();
      await ApiService.submitSurvey(widget.target['id'] as String, _answers.cast<int>(), comment.isEmpty ? null : comment);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: Colors.red),
        );
        setState(() => _sending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Menilai ${widget.target['fullName']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('1 = sangat kurang, 5 = sangat baik', style: TextStyle(color: Colors.grey)),
          for (var i = 0; i < widget.questions.length; i++)
            Card(
              margin: const EdgeInsets.only(top: 10),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${i + 1}. ${widget.questions[i]['dimension']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(widget.questions[i]['question'] as String),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (var v = 1; v <= 5; v++)
                          ChoiceChip(
                            label: Text('$v'),
                            selected: _answers[i] == v,
                            onSelected: (_) => setState(() => _answers[i] = v),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _comment,
            maxLength: 500,
            maxLines: 3,
            decoration: const InputDecoration(hintText: 'Masukan untuk rekan ini (opsional, anonim)', filled: true),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _sending ? null : _send,
            child: _sending
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Kirim penilaian'),
          ),
        ],
      ),
    );
  }
}
