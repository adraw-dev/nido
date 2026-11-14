package app.nido.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlin.math.ceil

/**
 * Hace sonar la alarma: sonido del sistema en bucle por el volumen de alarma,
 * vibración repetida y una notificación que abre la pantalla completa.
 * Sigue hasta que se apaga, se pospone o pasan [TIMEOUT_MS].
 */
class AlarmService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var restoreVolume: Int? = null
  private val timeout = Runnable { missed() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_RING -> {
        val alarm = Alarm.fromIntent(intent)
        if (alarm == null) {
          stopIfIdle()
        } else {
          start(alarm)
        }
      }
      ACTION_SNOOZE -> {
        current?.let { snooze(it) }
        finish()
      }
      ACTION_DISMISS -> finish()
      else -> stopIfIdle()
    }
    return START_NOT_STICKY
  }

  private fun stopIfIdle() {
    if (current == null) stopSelf()
  }

  private fun start(alarm: Alarm) {
    current = alarm
    ensureChannel(this)
    val notification = buildNotification(alarm)
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0,
    )

    if (wakeLock == null) {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nido:alarm").apply {
        setReferenceCounted(false)
        acquire(TIMEOUT_MS + 60_000L)
      }
    }
    // Si ya estaba sonando otra, sigue el mismo sonido; solo cambia el texto.
    if (player == null) {
      raiseVolume()
      playSound()
      vibrate()
    }
    handler.removeCallbacks(timeout)
    handler.postDelayed(timeout, TIMEOUT_MS)
    sendBroadcast(Intent(ACTION_CHANGED).setPackage(packageName))
  }

  private fun buildNotification(alarm: Alarm): Notification {
    val screen = PendingIntent.getActivity(
      this,
      0,
      Intent(this, AlarmActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(smallIcon(this))
      .setColor(TRUNK_BLUE)
      .setContentTitle(alarm.title)
      .setContentText(alarm.body.ifBlank { "Alarma de Nido" })
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(alarm.at)
      .setContentIntent(screen)
      .setFullScreenIntent(screen, true)
      .addAction(0, "Posponer $SNOOZE_MIN min", servicePending(ACTION_SNOOZE, 2))
      .addAction(0, "Apagar", servicePending(ACTION_DISMISS, 3))
      .build()
  }

  private fun servicePending(action: String, requestCode: Int): PendingIntent = PendingIntent.getService(
    this,
    requestCode,
    Intent(this, AlarmService::class.java).setAction(action),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  /** Garantiza un volumen de alarma audible mientras suena; al terminar lo deja como estaba. */
  private fun raiseVolume() {
    try {
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      val min = ceil(max * MIN_VOLUME).toInt()
      val now = am.getStreamVolume(AudioManager.STREAM_ALARM)
      if (now < min) {
        am.setStreamVolume(AudioManager.STREAM_ALARM, min, 0)
        restoreVolume = now
      }
    } catch (_: Exception) {
      // Algunos modos (No molestar) no dejan cambiar el volumen: se usa el que haya.
    }
  }

  private fun restoreVolume() {
    val previous = restoreVolume ?: return
    restoreVolume = null
    try {
      (getSystemService(Context.AUDIO_SERVICE) as AudioManager).setStreamVolume(AudioManager.STREAM_ALARM, previous, 0)
    } catch (_: Exception) {
    }
  }

  private fun playSound() {
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val candidates = listOfNotNull(
      RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM),
      Settings.System.DEFAULT_ALARM_ALERT_URI,
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
    )
    for (uri in candidates) {
      if (tryPlay(uri, attrs)) return
    }
  }

  private fun tryPlay(uri: Uri, attrs: AudioAttributes): Boolean {
    val mp = MediaPlayer()
    return try {
      mp.setAudioAttributes(attrs)
      mp.setDataSource(this, uri)
      mp.isLooping = true
      mp.prepare()
      mp.start()
      player = mp
      true
    } catch (_: Exception) {
      mp.release()
      false
    }
  }

  private fun vibrate() {
    val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    if (!v.hasVibrator()) return
    vibrator = v
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      v.vibrate(
        VibrationEffect.createWaveform(VIBRATION, 0),
        VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM),
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      v.vibrate(
        VibrationEffect.createWaveform(VIBRATION, 0),
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build(),
      )
    } else {
      @Suppress("DEPRECATION")
      v.vibrate(VIBRATION, 0)
    }
  }

  private fun snooze(alarm: Alarm) {
    val baseId = alarm.id.removePrefix(AlarmStore.SNOOZE_PREFIX)
    val next = alarm.copy(
      id = AlarmStore.SNOOZE_PREFIX + baseId,
      at = System.currentTimeMillis() + SNOOZE_MIN * 60_000L,
    )
    AlarmStore.put(this, next)
    AlarmScheduler.schedule(this, next)
  }

  /** Nadie la apagó: deja de sonar y queda un aviso silencioso. */
  private fun missed() {
    val alarm = current
    finish()
    if (alarm == null) return
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 4, it, PendingIntent.FLAG_IMMUTABLE)
    }
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(smallIcon(this))
      .setColor(TRUNK_BLUE)
      .setContentTitle("Alarma sin apagar: ${alarm.title}")
      .setContentText(alarm.body)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setAutoCancel(true)
      .setContentIntent(open)
      .build()
    try {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(MISSED_NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
    }
  }

  private fun finish() {
    handler.removeCallbacks(timeout)
    player?.let {
      try {
        it.stop()
      } catch (_: Exception) {
      }
      it.release()
    }
    player = null
    vibrator?.cancel()
    vibrator = null
    restoreVolume()
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    current = null
    sendBroadcast(Intent(ACTION_CHANGED).setPackage(packageName))
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    if (current != null) finish()
    super.onDestroy()
  }

  companion object {
    const val CHANNEL_ID = "nido-alarmas"
    private const val NOTIFICATION_ID = 7301
    private const val MISSED_NOTIFICATION_ID = 7302
    const val SNOOZE_MIN = 10
    /** Suena hasta 10 minutos si nadie la apaga. */
    private const val TIMEOUT_MS = 10 * 60_000L
    /** Volumen mínimo de alarma mientras suena (fracción del máximo). */
    private const val MIN_VOLUME = 0.7
    private val VIBRATION = longArrayOf(0, 900, 500, 900, 500, 1400, 900)
    private val TRUNK_BLUE = Color.parseColor("#3B5BDB")

    private const val ACTION_RING = "app.nido.alarm.RING"
    const val ACTION_SNOOZE = "app.nido.alarm.SNOOZE"
    const val ACTION_DISMISS = "app.nido.alarm.DISMISS"
    /** Avisa a la pantalla completa que la alarma cambió o terminó. */
    const val ACTION_CHANGED = "app.nido.alarm.CHANGED"

    /** La alarma que está sonando ahora, si hay una. */
    @Volatile
    var current: Alarm? = null
      private set

    fun ring(ctx: Context, alarm: Alarm) {
      val intent = alarm.putInto(Intent(ctx, AlarmService::class.java).setAction(ACTION_RING))
      try {
        ContextCompat.startForegroundService(ctx, intent)
      } catch (_: Exception) {
        // Android no dejó arrancar el servicio (pasa si la alarma no fue exacta): queda un aviso visible.
        fallbackNotification(ctx, alarm)
      }
    }

    private fun fallbackNotification(ctx: Context, alarm: Alarm) {
      ensureChannel(ctx)
      val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
        PendingIntent.getActivity(ctx, 5, it, PendingIntent.FLAG_IMMUTABLE)
      }
      val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
        .setSmallIcon(smallIcon(ctx))
        .setColor(TRUNK_BLUE)
        .setContentTitle(alarm.title)
        .setContentText(alarm.body)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setDefaults(NotificationCompat.DEFAULT_ALL)
        .setAutoCancel(true)
        .setContentIntent(open)
        .build()
      try {
        (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(MISSED_NOTIFICATION_ID, notification)
      } catch (_: SecurityException) {
      }
    }

    /** Apagar o posponer desde la pantalla completa. */
    fun send(ctx: Context, action: String) {
      try {
        ctx.startService(Intent(ctx, AlarmService::class.java).setAction(action))
      } catch (_: IllegalStateException) {
        // El servicio ya no corre.
      }
    }

    fun ensureChannel(ctx: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) != null) return
      val channel = NotificationChannel(CHANNEL_ID, "Alarmas", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Tareas de prioridad alta. El sonido lo pone la alarma, no la notificación."
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
      }
      nm.createNotificationChannel(channel)
    }

    /** Ícono monocromo que genera el plugin de expo-notifications; si no está, el de la app. */
    private fun smallIcon(ctx: Context): Int {
      val id = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
      return if (id != 0) id else ctx.applicationInfo.icon
    }
  }
}
