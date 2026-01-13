package com.nativatech.agendo;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private static final int REQ_NOTIFICATIONS = 1001;

  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      try {
        ActivityCompat.requestPermissions(this, new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
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

    String finalUrl = null;
    if (url.startsWith("agendo://")) {
      String rest = url.substring("agendo://".length());
      if (!rest.startsWith("/")) rest = "/" + rest;
      finalUrl = "https://agendo.nativatech.com.py" + rest;
    } else if (url.startsWith("https://agendo.nativatech.com.py") || url.startsWith("http://agendo.nativatech.com.py")) {
      finalUrl = url;
    }

    if (finalUrl == null) return;

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
}
