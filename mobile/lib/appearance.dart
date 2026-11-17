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
    final colors = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0D6D5C), brightness: brightness,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colors,
      scaffoldBackgroundColor: colors.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: colors.surface, foregroundColor: colors.onSurface,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: colors.surfaceContainerLow, elevation: 0,
        margin: const EdgeInsets.only(bottom: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true, fillColor: colors.surfaceContainerHighest,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
        minimumSize: const Size(48, 52),
      )),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colors.surfaceContainerLow,
        indicatorColor: colors.primaryContainer,
      ),
    );
  }
}
