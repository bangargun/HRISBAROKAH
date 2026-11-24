import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';

const _ink = Color(0xFF0F172A);

const _categoryLabel = {
  'ONBOARDING': 'Onboarding',
  'RESEP_BOH': 'Resep & dapur',
  'SERVICE_FOH': 'Layanan tamu',
  'HYGIENE_HACCP': 'Higiene & keamanan pangan',
  'LEADERSHIP': 'Kepemimpinan',
};

String _date(String ymd) => DateFormat('EEE, d MMM yyyy', 'id_ID').format(DateTime.parse(ymd));
String _err(Object e) => e.toString().replaceAll('Exception: ', '');

Future<void> _openLink(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tautan tidak bisa dibuka')));
  }
}

/// Pelatihan kru: materi + kuis modul, kuis mingguan, jadwal sesi. Nilai dihitung server.
class TrainingScreen extends StatelessWidget {
  const TrainingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text('Pelatihan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          backgroundColor: _ink,
          foregroundColor: Colors.white,
          bottom: const TabBar(
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Color(0xFFCFA04A),
            tabs: [Tab(text: 'Materi'), Tab(text: 'Kuis'), Tab(text: 'Jadwal')],
          ),
        ),
        body: const TabBarView(children: [_ModulesTab(), _QuizzesTab(), _SessionsTab()]),
      ),
    );
  }
}

/// Daftar dengan muat ulang tarik-ke-bawah, pesan galat dan pesan kosong.
class _AsyncList extends StatefulWidget {
  const _AsyncList({required this.kind, required this.empty, required this.itemBuilder});
  final String kind;
  final String empty;
  final Widget Function(BuildContext, Map<String, dynamic>, VoidCallback reload) itemBuilder;

  @override
  State<_AsyncList> createState() => _AsyncListState();
}

class _AsyncListState extends State<_AsyncList> {
  List<dynamic>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final items = await ApiService.getTrainingList(widget.kind);
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _error = _err(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: _error != null
          ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center))])
          : _items == null
              ? const Center(child: CircularProgressIndicator())
              : _items!.isEmpty
                  ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(widget.empty, textAlign: TextAlign.center))])
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items!.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, i) => widget.itemBuilder(context, _items![i] as Map<String, dynamic>, _load),
                    ),
    );
  }
}

class _ModulesTab extends StatelessWidget {
  const _ModulesTab();

  @override
  Widget build(BuildContext context) {
    return _AsyncList(
      kind: 'modules',
      empty: 'Belum ada materi untuk jabatan Anda.',
      itemBuilder: (context, m, reload) {
        final result = m['result'] as Map<String, dynamic>?;
        final passed = result?['passed'] == true;
        return Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            title: Text(m['title'], style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text([
              _categoryLabel[m['category']] ?? m['category'],
              if (m['isOnboarding'] == true) 'wajib kru baru',
              if (result != null && !passed) 'nilai terbaik ${result['bestScore']}',
            ].join(' · ')),
            trailing: passed
                ? const Chip(label: Text('Lulus'), backgroundColor: Color(0xFFDCFCE7))
                : const Icon(Icons.chevron_right),
            onTap: () async {
              await Navigator.push(context, MaterialPageRoute(builder: (_) => _ModuleScreen(id: m['id'])));
              reload();
            },
          ),
        );
      },
    );
  }
}

class _ModuleScreen extends StatefulWidget {
  const _ModuleScreen({required this.id});
  final String id;

  @override
  State<_ModuleScreen> createState() => _ModuleScreenState();
}

class _ModuleScreenState extends State<_ModuleScreen> {
  Map<String, dynamic>? _module;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final m = await ApiService.getTrainingItem('modules', widget.id);
      if (mounted) setState(() => _module = m);
    } catch (e) {
      if (mounted) setState(() => _error = _err(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = _module;
    final result = m?['result'] as Map<String, dynamic>?;
    final questions = (m?['questions'] as List<dynamic>?) ?? [];
    return Scaffold(
      appBar: AppBar(title: Text(m?['title'] ?? 'Materi'), backgroundColor: _ink, foregroundColor: Colors.white),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
          : m == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (result?['passed'] == true)
                      Card(
                        color: const Color(0xFFDCFCE7),
                        child: ListTile(
                          leading: const Icon(Icons.workspace_premium, color: Color(0xFF166534)),
                          title: Text('Lulus dengan nilai ${result!['bestScore']}'),
                          subtitle: Text('Sertifikat ${result['certificateNo']}'),
                        ),
                      ),
                    if ((m['description'] as String).isNotEmpty)
                      Text(m['description'], style: const TextStyle(color: Colors.black54)),
                    const SizedBox(height: 12),
                    SelectableText(m['content'], style: const TextStyle(fontSize: 15, height: 1.5)),
                    if (m['videoUrl'] != null) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () => _openLink(context, m['videoUrl']),
                        icon: const Icon(Icons.play_circle_outline),
                        label: const Text('Tonton video'),
                      ),
                    ],
                    const SizedBox(height: 24),
                    if (questions.isNotEmpty)
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: _ink, minimumSize: const Size.fromHeight(48)),
                        onPressed: () async {
                          final done = await Navigator.push<bool>(
                            context,
                            MaterialPageRoute(
                              builder: (_) => _QuizScreen(
                                kind: 'modules',
                                id: m['id'],
                                title: m['title'],
                                passingScore: m['passingScore'],
                                questions: questions,
                              ),
                            ),
                          );
                          if (done == true) _load();
                        },
                        child: Text(result == null
                            ? 'Kerjakan kuis (${questions.length} soal, lulus ${m['passingScore']})'
                            : 'Ulangi kuis (nilai terbaik ${result['bestScore']}, lulus ${m['passingScore']})'),
                      ),
                  ],
                ),
    );
  }
}

class _QuizzesTab extends StatelessWidget {
  const _QuizzesTab();

  @override
  Widget build(BuildContext context) {
    return _AsyncList(
      kind: 'quizzes',
      empty: 'Tidak ada kuis mingguan saat ini.',
      itemBuilder: (context, q, reload) {
        final attempt = q['attempt'] as Map<String, dynamic>?;
        return Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            title: Text(q['title'], style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(attempt != null
                ? 'Nilai ${attempt['score']} · ${attempt['passed'] == true ? 'lulus' : 'belum lulus'}'
                : q['open'] == true
                    ? 'Tenggat ${_date(q['deadline'])} · ${q['questionCount']} soal'
                    : 'Tenggat sudah lewat'),
            trailing: q['open'] == true ? const Icon(Icons.chevron_right) : null,
            onTap: q['open'] != true
                ? null
                : () async {
                    try {
                      final detail = await ApiService.getTrainingItem('quizzes', q['id']);
                      if (!context.mounted) return;
                      await Navigator.push<bool>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => _QuizScreen(
                            kind: 'quizzes',
                            id: q['id'],
                            title: q['title'],
                            passingScore: q['passingScore'],
                            questions: detail['questions'] as List<dynamic>,
                            oneShot: true,
                          ),
                        ),
                      );
                      reload();
                    } catch (e) {
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_err(e))));
                    }
                  },
          ),
        );
      },
    );
  }
}

/// Mengerjakan kuis: satu jawaban per soal, dikirim sekaligus; nilai dari server.
class _QuizScreen extends StatefulWidget {
  const _QuizScreen({
    required this.kind,
    required this.id,
    required this.title,
    required this.passingScore,
    required this.questions,
    this.oneShot = false,
  });
  final String kind;
  final String id;
  final String title;
  final int passingScore;
  final List<dynamic> questions;
  final bool oneShot;

  @override
  State<_QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<_QuizScreen> {
  late final List<int?> _answers = List.filled(widget.questions.length, null);
  bool _sending = false;
  Map<String, dynamic>? _outcome;

  Future<void> _submit() async {
    setState(() => _sending = true);
    try {
      final res = await ApiService.submitTrainingAnswers(widget.kind, widget.id, _answers.cast<int>());
      if (mounted) setState(() => _outcome = res);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_err(e))));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final outcome = _outcome;
    if (outcome != null) {
      final passed = outcome['passed'] == true;
      final cert = (outcome['result'] as Map<String, dynamic>?)?['certificateNo'];
      return Scaffold(
        appBar: AppBar(title: Text(widget.title), backgroundColor: _ink, foregroundColor: Colors.white, automaticallyImplyLeading: false),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(passed ? Icons.workspace_premium : Icons.refresh, size: 56, color: passed ? const Color(0xFF166534) : Colors.orange),
              const SizedBox(height: 12),
              Text('Nilai ${outcome['score']}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(
                passed
                    ? (cert != null ? 'Lulus. Sertifikat $cert.' : 'Lulus.')
                    : widget.oneShot
                        ? 'Belum mencapai nilai lulus ${widget.passingScore}.'
                        : 'Belum lulus (nilai lulus ${widget.passingScore}). Baca lagi materinya lalu ulangi.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: _ink),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Selesai'),
              ),
            ]),
          ),
        ),
      );
    }
    final complete = !_answers.contains(null);
    return Scaffold(
      appBar: AppBar(title: Text(widget.title), backgroundColor: _ink, foregroundColor: Colors.white),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.oneShot)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text('Kuis ini hanya bisa dikirim sekali.', style: TextStyle(color: Colors.black54)),
            ),
          for (var i = 0; i < widget.questions.length; i++)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${i + 1}. ${widget.questions[i]['prompt']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  RadioGroup<int>(
                    groupValue: _answers[i],
                    onChanged: (v) => setState(() => _answers[i] = v),
                    child: Column(children: [
                      for (var k = 0; k < (widget.questions[i]['options'] as List).length; k++)
                        RadioListTile<int>(
                          contentPadding: EdgeInsets.zero,
                          value: k,
                          title: Text(widget.questions[i]['options'][k]),
                        ),
                    ]),
                  ),
                ]),
              ),
            ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: _ink, minimumSize: const Size.fromHeight(48)),
            onPressed: !complete || _sending ? null : _submit,
            child: Text(_sending ? 'Mengirim…' : complete ? 'Kirim jawaban' : 'Jawab semua soal dulu'),
          ),
        ],
      ),
    );
  }
}

class _SessionsTab extends StatelessWidget {
  const _SessionsTab();

  @override
  Widget build(BuildContext context) {
    return _AsyncList(
      kind: 'sessions',
      empty: 'Belum ada jadwal pelatihan untuk Anda.',
      itemBuilder: (context, s, _) {
        final online = s['mode'] == 'ONLINE';
        final attended = s['attended'];
        return Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s['title'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 4),
              Text('${_date(s['date'])} · ${s['startTime']}–${s['endTime']}'),
              Text(online ? 'Online · pelatih ${s['trainerName']}' : '${s['location']} · pelatih ${s['trainerName']}'),
              if (s['status'] == 'DONE')
                Text(attended == true ? 'Hadir' : attended == false ? 'Tidak hadir' : 'Selesai',
                    style: TextStyle(color: attended == false ? Colors.red.shade700 : const Color(0xFF166534))),
              if (online && s['status'] == 'PLANNED' && s['meetingUrl'] != null)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => _openLink(context, s['meetingUrl']),
                    icon: const Icon(Icons.videocam_outlined),
                    label: const Text('Buka tautan rapat'),
                  ),
                ),
            ]),
          ),
        );
      },
    );
  }
}
