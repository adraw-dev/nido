package app.nido.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/** Una alarma agendada. `url` es la ruta de la app que se abre con "Ver tarea". */
data class Alarm(val id: String, val at: Long, val title: String, val body: String, val url: String) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("at", at)
    .put("title", title)
    .put("body", body)
    .put("url", url)

  fun putInto(intent: Intent): Intent = intent
    .putExtra(EXTRA_ID, id)
    .putExtra(EXTRA_AT, at)
    .putExtra(EXTRA_TITLE, title)
    .putExtra(EXTRA_BODY, body)
    .putExtra(EXTRA_URL, url)

  companion object {
    private const val EXTRA_ID = "app.nido.alarm.ID"
    private const val EXTRA_AT = "app.nido.alarm.AT"
    private const val EXTRA_TITLE = "app.nido.alarm.TITLE"
    private const val EXTRA_BODY = "app.nido.alarm.BODY"
    private const val EXTRA_URL = "app.nido.alarm.URL"

    fun fromJson(o: JSONObject) = Alarm(
      id = o.getString("id"),
      at = o.getLong("at"),
      title = o.optString("title"),
      body = o.optString("body"),
      url = o.optString("url", "/"),
    )

    fun fromIntent(intent: Intent?): Alarm? {
      val id = intent?.getStringExtra(EXTRA_ID) ?: return null
      return Alarm(
        id = id,
        at = intent.getLongExtra(EXTRA_AT, System.currentTimeMillis()),
        title = intent.getStringExtra(EXTRA_TITLE) ?: "Nido",
        body = intent.getStringExtra(EXTRA_BODY) ?: "",
        url = intent.getStringExtra(EXTRA_URL) ?: "/",
      )
    }
  }
}

/**
 * Guarda las alarmas en el celular (SharedPreferences) para poder cancelarlas,
 * contarlas y volver a agendarlas al reiniciar el teléfono.
 */
object AlarmStore {
  private const val PREFS = "nido_alarm"
  private const val KEY = "alarms"

  /** Alarmas que no vienen del plan de la app: posponer y prueba. La sincronización no las borra. */
  const val SNOOZE_PREFIX = "snooze:"
  const val TEST_ID = "snooze:test"

  fun isExtra(id: String) = id.startsWith(SNOOZE_PREFIX)

  @Synchronized
  fun all(ctx: Context): MutableMap<String, Alarm> {
    val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return mutableMapOf()
    return try {
      val arr = JSONArray(raw)
      val out = LinkedHashMap<String, Alarm>()
      for (i in 0 until arr.length()) {
        val a = Alarm.fromJson(arr.getJSONObject(i))
        out[a.id] = a
      }
      out
    } catch (_: Exception) {
      mutableMapOf()
    }
  }

  @Synchronized
  fun save(ctx: Context, alarms: Collection<Alarm>) {
    val arr = JSONArray()
    alarms.forEach { arr.put(it.toJson()) }
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply()
  }

  @Synchronized
  fun put(ctx: Context, alarm: Alarm) {
    val map = all(ctx)
    map[alarm.id] = alarm
    save(ctx, map.values)
  }

  @Synchronized
  fun remove(ctx: Context, id: String): Alarm? {
    val map = all(ctx)
    val removed = map.remove(id)
    if (removed != null) save(ctx, map.values)
    return removed
  }
}

/** Agenda y cancela alarmas en AlarmManager. */
object AlarmScheduler {
  const val ACTION_FIRE = "app.nido.alarm.FIRE"

  private fun alarmManager(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun canScheduleExact(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(ctx).canScheduleExactAlarms()

  /** El `data` distingue un PendingIntent de otro (los extras no cuentan para eso). */
  private fun fireIntent(ctx: Context, id: String) = Intent(ctx, AlarmReceiver::class.java)
    .setAction(ACTION_FIRE)
    .setData(Uri.parse("nido-alarm://alarm/${Uri.encode(id)}"))
    .putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)

  fun schedule(ctx: Context, alarm: Alarm) {
    val am = alarmManager(ctx)
    val fire = PendingIntent.getBroadcast(
      ctx,
      0,
      fireIntent(ctx, alarm.id),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    try {
      if (canScheduleExact(ctx)) {
        // Como un despertador: hora exacta, ignora el reposo y muestra el ícono de alarma.
        val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
        val show = launch?.let { PendingIntent.getActivity(ctx, 1, it, PendingIntent.FLAG_IMMUTABLE) }
        am.setAlarmClock(AlarmManager.AlarmClockInfo(alarm.at, show), fire)
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.at, fire)
      } else {
        am.set(AlarmManager.RTC_WAKEUP, alarm.at, fire)
      }
    } catch (_: SecurityException) {
      // Sin permiso de hora exacta: queda aproximada.
      am.set(AlarmManager.RTC_WAKEUP, alarm.at, fire)
    }
  }

  fun cancel(ctx: Context, id: String) {
    val pi = PendingIntent.getBroadcast(
      ctx,
      0,
      fireIntent(ctx, id),
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    ) ?: return
    alarmManager(ctx).cancel(pi)
    pi.cancel()
  }

  /**
   * Deja agendado exactamente `wanted` (lo que manda la app) y conserva las
   * alarmas pospuestas o de prueba que aún no han sonado.
   */
  fun sync(ctx: Context, wanted: List<Alarm>) {
    val now = System.currentTimeMillis()
    val current = AlarmStore.all(ctx)
    val next = wanted.filter { it.at > now }.associateBy { it.id }

    for ((id, alarm) in current) {
      val keepExtra = AlarmStore.isExtra(id) && alarm.at > now
      if (!keepExtra && id !in next) cancel(ctx, id)
    }
    next.values.forEach { schedule(ctx, it) }

    val extras = current.values.filter { AlarmStore.isExtra(it.id) && it.at > now }
    AlarmStore.save(ctx, next.values + extras)
  }

  /** Tras reiniciar el celular las alarmas se pierden: se vuelven a poner las que faltan. */
  fun restoreAll(ctx: Context) {
    val now = System.currentTimeMillis()
    val future = AlarmStore.all(ctx).values.filter { it.at > now }
    future.forEach { schedule(ctx, it) }
    AlarmStore.save(ctx, future)
  }

  fun cancelAll(ctx: Context) {
    AlarmStore.all(ctx).keys.forEach { cancel(ctx, it) }
    AlarmStore.save(ctx, emptyList())
  }
}
