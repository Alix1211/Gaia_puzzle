package com.gaia.wellnessroyale;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.util.Collections;
import org.json.JSONArray;

public final class MainActivity extends Activity {
    private WebView web;
    private boolean ready;
    private boolean paused;
    private static final String GAME_URL = "https://appassets.androidplatform.net/assets/index.html";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setBackgroundColor(0xff100d11);
        immersive();
        web = new WebView(this);
        web.setBackgroundColor(0xff100d11);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSupportZoom(false);
        web.addJavascriptInterface(new Haptics(), "GaiaNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !GAME_URL.equals(r.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                if (GAME_URL.equals(r.getUrl().toString())) {
                    try {
                        return new WebResourceResponse("text/html", "UTF-8", 200, "OK",
                            Collections.singletonMap("Cache-Control", "no-store"), getAssets().open("index.html"));
                    } catch (Exception e) { return blocked(); }
                }
                return blocked();
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (!GAME_URL.equals(url)) return;
                ready = true;
                v.evaluateJavascript("(()=>{try{Object.defineProperty(navigator,'vibrate',{value:p=>{GaiaNative.vibrate(JSON.stringify(p));return true;},configurable:true});}catch(e){}})()", null);
                setAudioPaused(paused);
                immersive();
            }
        });
        setContentView(web);
        web.loadUrl(GAME_URL);
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private void immersive() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    private void setAudioPaused(boolean value) {
        if (!ready || web == null) return;
        if (value) web.evaluateJavascript("if(window.GAIA_DEBUG)GAIA_DEBUG.audio.setEnabled(false)", null);
        else web.evaluateJavascript("if(window.GAIA_DEBUG){const d=GAIA_DEBUG;d.audio.setEnabled(d.game.sound);d.audio.selectScene(d.game.stage==='menu'?'menu':d.game.memberIndex===0?'one':d.game.memberIndex===1?'two':['STANDARD','SILVER'].includes(d.MEMBERS[d.game.memberIndex].tier)?'one':'two');}", null);
    }

    @Override protected void onPause() {
        paused = true;
        setAudioPaused(true);
        if (web != null) web.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        paused = false;
        if (web != null) { web.onResume(); setAudioPaused(false); }
        immersive();
    }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) immersive();
    }
    @Override public void onBackPressed() {
        new AlertDialog.Builder(this).setMessage("게임을 종료하시겠습니까? 완료한 판의 성장 기록은 유지됩니다.")
            .setNegativeButton("계속하기", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int which) { immersive(); }
            })
            .setPositiveButton("종료", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int which) { finish(); }
            }).show();
    }
    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("GaiaNative"); web.destroy(); web = null; }
        super.onDestroy();
    }

    public final class Haptics {
        @JavascriptInterface public void vibrate(String json) {
            try {
                Vibrator v;
                if (Build.VERSION.SDK_INT >= 31) {
                    VibratorManager m = (VibratorManager)getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    v = m.getDefaultVibrator();
                } else v = (Vibrator)getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                if ("0".equals(json) || "[]".equals(json)) { v.cancel(); return; }
                if (json.startsWith("[")) {
                    JSONArray a = new JSONArray(json);
                    int n = Math.min(a.length(), 32);
                    if (n == 0) { v.cancel(); return; }
                    long[] pattern = new long[n+1];
                    for (int i=0;i<n;i++) pattern[i+1]=Math.max(0,Math.min(1000,a.optLong(i,0)));
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern,-1));
                    else v.vibrate(pattern,-1);
                } else {
                    long duration = Math.max(0,Math.min(1000,Long.parseLong(json)));
                    if (duration == 0) { v.cancel(); return; }
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(duration,VibrationEffect.DEFAULT_AMPLITUDE));
                    else v.vibrate(duration);
                }
            } catch (Exception ignored) { }
        }
    }
}
