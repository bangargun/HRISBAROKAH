import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

/// Slip gaji kru: daftar periode yang sudah difinalkan HR, dengan rincian per periode.
class PayslipScreen extends StatefulWidget {
  const PayslipScreen({super.key});

  @override
  State<PayslipScreen> createState() => _PayslipScreenState();
}

class _PayslipScreenState extends State<PayslipScreen> {
  List<dynamic>? _slips;
  String? _error;

  static final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
  static const _months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final slips = await ApiService.getMyPayslips();
      if (mounted) setState(() => _slips = slips);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    }
  }

  static double _num(dynamic v) => v == null ? 0 : double.tryParse(v.toString()) ?? 0;
  static String _period(Map slip) => '${_months[(slip['periodMonth'] as int) - 1]} ${slip['periodYear']}';
  static String _date(String ymd) => DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(ymd));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Slip Gaji', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center))])
            : _slips == null
                ? const Center(child: CircularProgressIndicator())
                : _slips!.isEmpty
                    ? ListView(children: const [
                        Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'Belum ada slip gaji. Slip muncul setelah HR memfinalkan gaji periode Anda.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ])
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _slips!.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final slip = _slips![i] as Map;
                          final paid = slip['isPaid'] == true;
                          return Card(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: ListTile(
                              title: Text(_period(slip), style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text(_rupiah.format(_num(slip['netSalary']))),
                              trailing: Text(
                                paid ? 'Sudah dibayar' : 'Belum dibayar',
                                style: TextStyle(fontSize: 12, color: paid ? Colors.green : Colors.orange.shade800),
                              ),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => _PayslipDetail(slip: slip)),
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}

class _PayslipDetail extends StatelessWidget {
  final Map slip;
  const _PayslipDetail({required this.slip});

  @override
  Widget build(BuildContext context) {
    final n = _PayslipScreenState._num;
    final rp = _PayslipScreenState._rupiah.format;
    // Hanya baris yang berisi agar slip ringkas
    final earnings = <(String, double)>[
      ('Gaji pokok', n(slip['basicSalary'])),
      ('Tunjangan masa kerja', n(slip['tenureAllowance'])),
      ('Uang makan', n(slip['mealAllowance'])),
      ('Lembur', n(slip['overtimePay'])),
      ('Service charge', n(slip['serviceCharge'])),
      ('Bonus / insentif', n(slip['bonusIncentive'])),
    ].where((e) => e.$1 == 'Gaji pokok' || e.$2 != 0).toList();
    final deductions = <(String, double)>[
      ('Potongan tidak masuk (${slip['unpaidLeaveDays']} hari)', n(slip['unpaidDeduction'])),
      ('Potongan terlambat (${slip['lateMinutes']} menit)', n(slip['latePenalty'])),
      ('Cicilan kasbon', n(slip['kasbonDeduction'])),
      ('Denda / sanksi', n(slip['sanctionDeduction'])),
      ('BPJS Kesehatan', n(slip['bpjsKesehatan'])),
      ('BPJS Ketenagakerjaan', n(slip['bpjsKetenagakerjaan'])),
    ].where((e) => e.$2 != 0).toList();

    Widget line(String label, double value, {bool minus = false, bool bold = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Expanded(child: Text(label, style: TextStyle(fontWeight: bold ? FontWeight.bold : null))),
              Text(
                '${minus ? '- ' : ''}${rp(value)}',
                style: TextStyle(fontWeight: bold ? FontWeight.bold : null, color: minus ? Colors.red.shade700 : null),
              ),
            ],
          ),
        );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Slip ${_PayslipScreenState._period(slip)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(slip['outlet']?['name'] ?? '-', style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(
                    'Periode ${_PayslipScreenState._date(slip['periodStart'])} – ${_PayslipScreenState._date(slip['periodEnd'])}',
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Hadir ${slip['daysPresent']} hari · tidak masuk ${slip['absentDays']} hari · terlambat ${slip['lateMinutes']} menit',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                  ),
                  const Divider(height: 24),
                  const Text('Pendapatan', style: TextStyle(fontWeight: FontWeight.bold)),
                  for (final e in earnings) line(e.$1, e.$2),
                  if (deductions.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Text('Potongan', style: TextStyle(fontWeight: FontWeight.bold)),
                    for (final d in deductions) line(d.$1, d.$2, minus: true),
                  ],
                  const Divider(height: 24),
                  line('Gaji bersih', n(slip['netSalary']), bold: true),
                  const SizedBox(height: 8),
                  Text(
                    slip['isPaid'] == true && slip['paidAt'] != null
                        ? 'Dibayar ${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(slip['paidAt']).toLocal())}'
                        : 'Belum dibayar',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
