package com.nativatech.agendo;

import android.app.Application;
import android.content.Intent;
import android.net.Uri;

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.INotificationClickEvent;
import com.onesignal.notifications.INotificationClickListener;

import org.json.JSONObject;

public class ApplicationClass extends Application {
  @Override
  public void onCreate() {
    super.onCreate();

    OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
    OneSignal.initWithContext(this, "f3a13f2c-2b1b-4d5c-b17d-1e90c6e237cb");

    OneSignal.getNotifications().addClickListener(
        new INotificationClickListener() {
          @Override
          public void onClick(INotificationClickEvent event) {
            try {
              JSONObject data = event.getNotification().getAdditionalData();
              String url = data != null ? data.optString("url", null) : null;
              if (url == null || url.trim().isEmpty()) {
                return;
              }

              String finalUrl = url;
              if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
                if (!finalUrl.startsWith("/")) finalUrl = "/" + finalUrl;
                finalUrl = "https://agendo.nativatech.com.py" + finalUrl;
              }

              Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(finalUrl));
              intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
              startActivity(intent);
            } catch (Throwable t) {
              // ignore
            }
          }
        });
  }
}
