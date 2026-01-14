package com.nativatech.agendo;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;
import com.onesignal.OneSignal;

public class MainActivity extends BridgeActivity {

  private static final int REQ_NOTIFICATIONS = 1001;

  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(OneSignalBridgePlugin.class);
    super.onCreate(savedInstanceState);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      try {
        ActivityCompat.requestPermissions(this, new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
      } catch (Throwable t) {
      }
    } else {
      try {
        oneSignalOptInBestEffort();
      } catch (Throwable t) {
      }
    }

    try {
      handleDeepLink(getIntent());
    } catch (Throwable t) {
    }
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);

    try {
      handleDeepLink(intent);
    } catch (Throwable t) {
    }
  }

  private void handleDeepLink(Intent intent) {
    if (intent == null) return;
    Uri data = intent.getData();
    if (data == null) return;

    String url = data.toString();
    if (url == null || url.trim().isEmpty()) return;

    try {
      int embedded = url.indexOf("agendo://");
      if (embedded > 0) {
        url = url.substring(embedded);
      }
    } catch (Throwable t) {
    }

    try {
      Log.d("AgendoDeepLink", "intentUrl=" + url);
    } catch (Throwable t) {
    }

    String finalUrl = null;
    if (url.startsWith("agendo://")) {
      String rest = url.substring("agendo://".length());
      int cut = rest.length();
      int q = rest.indexOf('?');
      int h = rest.indexOf('#');
      if (q >= 0 && q < cut) cut = q;
      if (h >= 0 && h < cut) cut = h;
      rest = rest.substring(0, cut);
      while (rest.startsWith("/")) rest = rest.substring(1);
      while (rest.endsWith("/")) rest = rest.substring(0, rest.length() - 1);

      String routeKey = rest;
      int slash = routeKey.indexOf('/');
      if (slash >= 0) routeKey = routeKey.substring(0, slash);

      String path = null;
      if (routeKey.equals("schedule")) path = "/schedule";
      else if (routeKey.equals("finance")) path = "/finance";
      else if (routeKey.equals("students")) path = "/students";
      else if (routeKey.equals("users")) path = "/users";
      else if (routeKey.isEmpty()) path = "/";
      else path = "/" + routeKey;

      finalUrl = "https://agendo.nativatech.com.py" + path;
    } else if (url.startsWith("https://agendo.nativatech.com.py") || url.startsWith("http://agendo.nativatech.com.py")) {
      try {
        Uri u = Uri.parse(url);
        String p = u.getPath();
        if (p != null && p.startsWith("/agendo://")) {
          url = "agendo://" + p.substring("/agendo://".length());
          String rest = url.substring("agendo://".length());
          int cut = rest.length();
          int q = rest.indexOf('?');
          int h = rest.indexOf('#');
          if (q >= 0 && q < cut) cut = q;
          if (h >= 0 && h < cut) cut = h;
          rest = rest.substring(0, cut);
          while (rest.startsWith("/")) rest = rest.substring(1);
          while (rest.endsWith("/")) rest = rest.substring(0, rest.length() - 1);

          String routeKey = rest;
          int slash = routeKey.indexOf('/');
          if (slash >= 0) routeKey = routeKey.substring(0, slash);

          String path = null;
          if (routeKey.equals("schedule")) path = "/schedule";
          else if (routeKey.equals("finance")) path = "/finance";
          else if (routeKey.equals("students")) path = "/students";
          else if (routeKey.equals("users")) path = "/users";
          else if (routeKey.isEmpty()) path = "/";
          else path = "/" + routeKey;

          finalUrl = "https://agendo.nativatech.com.py" + path;
        } else {
          finalUrl = url;
        }
      } catch (Throwable t) {
        finalUrl = url;
      }
    }

    if (finalUrl == null) return;

    try {
      Log.d("AgendoDeepLink", "finalUrl=" + finalUrl);
    } catch (Throwable t) {
    }

    final String toLoad = finalUrl;
    runOnUiThread(
        () -> {
          try {
            if (getBridge() != null && getBridge().getWebView() != null) {
              getBridge().getWebView().loadUrl(toLoad);
            }
          } catch (Throwable t) {
          }
        });
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);

    if (requestCode == REQ_NOTIFICATIONS) {
      try {
        oneSignalOptInBestEffort();
      } catch (Throwable t) {
      }
    }
  }

  private void oneSignalOptInBestEffort() {
    // OneSignal v5 expone APIs Kotlin/Java que varían entre versiones.
    // Usamos reflection para evitar errores de compilación.
    try {
      Object user = OneSignal.class.getMethod("getUser").invoke(null);
      if (user == null) return;
      Object pushSub = user.getClass().getMethod("getPushSubscription").invoke(user);
      if (pushSub == null) return;
      pushSub.getClass().getMethod("optIn").invoke(pushSub);
    } catch (Throwable t) {
      // ignore
    }
  }
}
