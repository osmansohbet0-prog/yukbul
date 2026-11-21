package tr.com.yukvinc.yukvinc_mobile

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class UpdateFileProvider : FileProvider()

class MainActivity : FlutterActivity() {
    private val settingsRequest = 7821
    private var settingsReply: MethodChannel.Result? = null
    private val updateDir get() = File(cacheDir, "yv-updates")

    private fun mayInstall(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "tr.com.yukvinc/updates")
            .setMethodCallHandler { call, reply ->
                try {
                    when (call.method) {
                        "directory" -> {
                            val dir = updateDir
                            if (dir.isDirectory || dir.mkdirs()) reply.success(dir.absolutePath)
                            else reply.error("storage", "Güncelleme klasörü oluşturulamadı.", null)
                        }
                        "canInstall" -> reply.success(mayInstall())
                        "settings" -> {
                            if (mayInstall()) reply.success(true)
                            else if (settingsReply != null) reply.error("busy", "İzin ekranı zaten açık.", null)
                            else {
                                startActivityForResult(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + packageName)), settingsRequest)
                                settingsReply = reply
                            }
                        }
                        "install" -> {
                            val name = call.arguments as? String ?: ""
                            if (!Regex("""YukVinc-Android-\d{1,5}\.\d{1,5}\.\d{1,5}\.apk""").matches(name)) {
                                reply.error("invalid", "Güncelleme dosya adı geçersiz.", null)
                            } else if (!mayInstall()) {
                                reply.error("permission", "Android, YükVinç için yükleme iznini kapalı gösteriyor.", null)
                            } else {
                                val file = File(updateDir, name)
                                if (!file.isFile) reply.error("missing", "Doğrulanmış APK bulunamadı.", null)
                                else {
                                    val uri = FileProvider.getUriForFile(this, packageName + ".updates", file)
                                    val intent = Intent(Intent.ACTION_VIEW)
                                        .setDataAndType(uri, "application/vnd.android.package-archive")
                                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                    intent.clipData = ClipData.newRawUri("YükVinç APK", uri)
                                    startActivity(intent)
                                    reply.success(null)
                                }
                            }
                        }
                        else -> reply.notImplemented()
                    }
                } catch (e: ActivityNotFoundException) {
                    reply.error("unavailable", "Android bu işlem için bir sistem ekranı sunmadı.", null)
                } catch (e: SecurityException) {
                    reply.error("blocked", "Android bu işleme izin vermedi.", null)
                } catch (e: Exception) {
                    reply.error("system", "Android güncelleme işlemini başlatamadı.", null)
                }
            }
    }

    @Deprecated("Android activity result compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == settingsRequest) {
            settingsReply?.success(mayInstall())
            settingsReply = null
        }
    }
}
