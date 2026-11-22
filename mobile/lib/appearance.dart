import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppAppearance {
  static final mode = ValueNotifier<ThemeMode>(ThemeMode.system);

  static Future<void> load() async {
    final preferences = await SharedPreferences.getInstance();
    final value = preferences.getString('yukvinc.theme');
    mode.value = ThemeMode.values.firstWhere(
      (item) => item.name == value, orElse: () => ThemeMode.system,
    );
  }

  static Future<void> save(ThemeMode value) async {
    final preferences = await SharedPreferences.getInstance();
    if (!await preferences.setString('yukvinc.theme', value.name)) {
      throw StateError('Görünüm kaydedilemedi.');
    }
    mode.value = value;
  }

  static ThemeData theme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final colors = ColorScheme.fromSeed(
      seedColor: const Color(0xFF172D35),
      brightness: brightness,
    ).copyWith(secondary: const Color(0xFFE7A339));
    return ThemeData(
      useMaterial3: true,
      colorScheme: colors,
      scaffoldBackgroundColor: dark ? const Color(0xFF101719) : const Color(0xFFF3F5F6),
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? const Color(0xFF101719) : const Color(0xFFF3F5F6),
        foregroundColor: colors.onSurface,
        centerTitle: false,
        toolbarHeight: 68,
      ),
      cardTheme: CardThemeData(
        color: colors.surfaceContainerLow,
        elevation: 0,
        margin: const EdgeInsets.only(bottom: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colors.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colors.outlineVariant),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      )),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: colors.surface,
        indicatorColor: colors.secondaryContainer,
        labelTextStyle: WidgetStateProperty.resolveWith((states) =>
          TextStyle(fontSize: 11, fontWeight: states.contains(WidgetState.selected)
            ? FontWeight.w800 : FontWeight.w500)),
      ),
    );
  }
}
