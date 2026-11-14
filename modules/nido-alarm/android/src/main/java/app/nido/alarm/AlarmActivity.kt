package app.nido.alarm

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.animation.ValueAnimator
import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.format.DateFormat
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import java.util.Date

/**
 * Pantalla de la alarma: aparece sobre el bloqueo y enciende la pantalla.
 * Apagar, posponer o abrir la tarea en Nido.
 */
class AlarmActivity : Activity() {
  private lateinit var timeView: TextView
  private lateinit var titleView: TextView
  private lateinit var bodyView: TextView
  private var pulse: ObjectAnimator? = null
  /** Ya se eligió una acción: no cerrar antes de tiempo al recibir el cambio. */
  private var leaving = false

  private val changed = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = render()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    setContentView(buildLayout())
    ContextCompat.registerReceiver(
      this,
      changed,
      IntentFilter(AlarmService.ACTION_CHANGED),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    render()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    render()
  }

  override fun onResume() {
    super.onResume()
    render()
  }

  override fun onDestroy() {
    pulse?.cancel()
    unregisterReceiver(changed)
    super.onDestroy()
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    // En Android 15+ (borde a borde) se ignora; ahí el fondo ya es BG.
    @Suppress("DEPRECATION")
    window.statusBarColor = BG
    @Suppress("DEPRECATION")
    window.navigationBarColor = BG
  }

  /** Muestra la alarma que suena; si ya no hay ninguna, se cierra. */
  private fun render() {
    if (leaving) return
    val alarm = AlarmService.current
    if (alarm == null) {
      finish()
      return
    }
    timeView.text = DateFormat.getTimeFormat(this).format(Date(alarm.at))
    titleView.text = alarm.title
    bodyView.text = alarm.body
    bodyView.visibility = if (alarm.body.isBlank()) View.GONE else View.VISIBLE
  }

  private fun dismiss() {
    leaving = true
    AlarmService.send(this, AlarmService.ACTION_DISMISS)
    finish()
  }

  private fun snooze() {
    leaving = true
    AlarmService.send(this, AlarmService.ACTION_SNOOZE)
    finish()
  }

  /** Apaga y abre la tarea en Nido (pide desbloquear si hace falta). */
  private fun openTask() {
    leaving = true
    val url = AlarmService.current?.url ?: "/"
    AlarmService.send(this, AlarmService.ACTION_DISMISS)
    val path = url.trimStart('/')
    val intent = if (path.isEmpty()) {
      packageManager.getLaunchIntentForPackage(packageName)
    } else {
      Intent(Intent.ACTION_VIEW, Uri.parse("nido://$path")).setPackage(packageName)
    }?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    val launch = {
      intent?.let { runCatching { startActivity(it) } }
      finish()
    }
    val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard.isKeyguardLocked) {
      keyguard.requestDismissKeyguard(
        this,
        object : KeyguardManager.KeyguardDismissCallback() {
          override fun onDismissSucceeded() = launch()
          override fun onDismissCancelled() = finish()
          override fun onDismissError() = launch()
        },
      )
    } else {
      launch()
    }
  }

  // region Diseño (sin XML: la pantalla es pequeña y así vive en un solo archivo)

  private fun buildLayout(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(BG)
      setPadding(dp(28), dp(56), dp(28), dp(36))
    }

    root.addView(text("ALARMA · PRIORIDAD ALTA", 13f, TRUNK, bold = true).apply {
      letterSpacing = 0.12f
    })

    timeView = text("", 72f, INK, bold = true).apply {
      setPadding(0, dp(8), 0, 0)
      includeFontPadding = false
    }
    root.addView(timeView)

    // La estación del tronco, latiendo mientras suena.
    val station = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(BG)
        setStroke(dp(8), TRUNK)
      }
    }
    val stationBox = FrameLayout(this).apply {
      addView(View(this@AlarmActivity).apply { setBackgroundColor(TRUNK) }, FrameLayout.LayoutParams(dp(8), FrameLayout.LayoutParams.MATCH_PARENT, Gravity.CENTER_HORIZONTAL))
      addView(station, FrameLayout.LayoutParams(dp(56), dp(56), Gravity.CENTER))
    }
    root.addView(stationBox, LinearLayout.LayoutParams(dp(56), 0, 1f).apply {
      topMargin = dp(24)
      bottomMargin = dp(24)
    })
    pulse = ObjectAnimator.ofPropertyValuesHolder(
      station,
      PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.18f),
      PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.18f),
    ).apply {
      duration = 700
      repeatMode = ValueAnimator.REVERSE
      repeatCount = ValueAnimator.INFINITE
      start()
    }

    titleView = text("", 30f, INK, bold = true)
    root.addView(titleView)
    bodyView = text("", 17f, INK_MUTED).apply { setPadding(0, dp(8), 0, 0) }
    root.addView(bodyView)

    root.addView(button("Apagar", filled = true) { dismiss() }, buttonParams(top = 36))
    root.addView(button("Posponer ${AlarmService.SNOOZE_MIN} min", filled = false) { snooze() }, buttonParams(top = 12))
    root.addView(
      text("Ver en Nido", 16f, TRUNK, bold = true).apply {
        gravity = Gravity.CENTER
        setPadding(0, dp(14), 0, dp(14))
        isClickable = true
        isFocusable = true
        contentDescription = "Apagar y abrirlo en Nido"
        setOnClickListener { openTask() }
      },
      buttonParams(top = 8),
    )
    return root
  }

  private fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
    text = value
    setTextColor(color)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    if (bold) typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
  }

  private fun button(label: String, filled: Boolean, onClick: () -> Unit) = TextView(this).apply {
    text = label
    gravity = Gravity.CENTER
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    setTextColor(if (filled) Color.WHITE else INK)
    background = GradientDrawable().apply {
      cornerRadius = dp(32).toFloat()
      if (filled) setColor(TRUNK_FILL) else setStroke(dp(2), RULE)
    }
    isClickable = true
    isFocusable = true
    setOnClickListener { onClick() }
  }

  private fun buttonParams(top: Int) = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64)).apply {
    topMargin = dp(top)
  }

  private fun dp(value: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

  // endregion

  companion object {
    // Tokens "Línea de metro", tema oscuro (src/ui/tokens.ts).
    private val BG = Color.parseColor("#111315")
    private val INK = Color.parseColor("#ECEEF0")
    private val INK_MUTED = Color.parseColor("#B4BAC0")
    private val RULE = Color.parseColor("#3A3F45")
    private val TRUNK = Color.parseColor("#5C7CFA")
    private val TRUNK_FILL = Color.parseColor("#3B5BDB")
  }
}
