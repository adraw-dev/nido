package app.nido.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Recibe la hora de la alarma y el reinicio del celular. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmScheduler.ACTION_FIRE -> {
        val id = intent.getStringExtra(EXTRA_ALARM_ID) ?: return
        // Una alarma suena una vez: sale del registro y el servicio la hace sonar.
        val alarm = AlarmStore.remove(context, id) ?: return
        AlarmService.ring(context, alarm)
      }
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> AlarmScheduler.restoreAll(context)
    }
  }

  companion object {
    const val EXTRA_ALARM_ID = "app.nido.alarm.FIRE_ID"
  }
}
