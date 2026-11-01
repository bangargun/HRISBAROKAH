import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_user/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const HrisMobileApp(isLoggedIn: false));
    expect(find.text('HRIS RESTORAN'), findsOneWidget);
  });
}
