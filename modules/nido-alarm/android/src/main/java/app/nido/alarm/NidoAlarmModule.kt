package app.nido.alarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AlarmRecord : Record {
  @Field var id: String = ""
  /** Milisegundos desde 1970 (Date.getTime()). */
  @Field var at: Double = 0.0
  @Field var title: String = ""
  @Field var body: String = ""
  @Field var url: String = "/"

  fun toAlarm() = Alarm(id, at.toLong(), title, body, url)
}

class NidoAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("NidoAlarm")

    /** Deja agendadas exactamente estas alarmas (más las pospuestas). Devuelve cuántas quedaron. */
    Function("sync") { alarms: List<AlarmRecord> ->
      AlarmService.ensureChannel(context)
      AlarmScheduler.sync(context, alarms.map { it.toAlarm() })
      AlarmStore.all(context).size
    }

    Function("scheduledCount") {
      AlarmStore.all(context).size
    }

    Function("cancelAll") {
      AlarmScheduler.cancelAll(context)
    }

    /** Alarma de prueba en `seconds` segundos. */
    Function("test") { seconds: Int ->
      val alarm = Alarm(
        id = AlarmStore.TEST_ID,
        at = System.currentTimeMillis() + seconds * 1000L,
        title = "Alarma de prueba",
        body = "Así suenan las tareas de prioridad alta.",
        url = "/",
      )
      AlarmService.ensureChannel(context)
      AlarmStore.put(context, alarm)
      AlarmScheduler.schedule(context, alarm)
    }

    Function("status") {
      mapOf(
        "exact" to AlarmScheduler.canScheduleExact(context),
        "fullScreen" to canUseFullScreen(context),
      )
    }

    Function("openExactSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
      } else {
        openSettings(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      }
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        openSettings(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
      } else {
        openSettings(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      }
    }
  }

  private fun canUseFullScreen(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return nm.canUseFullScreenIntent()
  }

  private fun openSettings(action: String) {
    val intent = Intent(action, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (_: Exception) {
      context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }
  }
}
