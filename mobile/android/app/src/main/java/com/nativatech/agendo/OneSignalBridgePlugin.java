package com.nativatech.agendo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.onesignal.OneSignal;
import android.util.Log;

@CapacitorPlugin(name = "OneSignalBridge")
public class OneSignalBridgePlugin extends Plugin {

  @PluginMethod
  public void login(PluginCall call) {
    String userId = call.getString("userId");
    if (userId == null || userId.trim().isEmpty()) {
      call.reject("Missing userId");
      return;
    }

    try {
      try {
        Log.d("OneSignalBridge", "login external_user_id=" + userId);
      } catch (Throwable t) {
      }
      OneSignal.login(userId);
      JSObject ret = new JSObject();
      ret.put("ok", true);
      call.resolve(ret);
    } catch (Throwable t) {
      call.reject(t.getMessage() != null ? t.getMessage() : "OneSignal.login failed");
    }
  }

  @PluginMethod
  public void logout(PluginCall call) {
    try {
      try {
        Log.d("OneSignalBridge", "logout");
      } catch (Throwable t) {
      }
      OneSignal.logout();
      JSObject ret = new JSObject();
      ret.put("ok", true);
      call.resolve(ret);
    } catch (Throwable t) {
      call.reject(t.getMessage() != null ? t.getMessage() : "OneSignal.logout failed");
    }
  }

  @PluginMethod
  public void debugState(PluginCall call) {
    JSObject ret = new JSObject();

    try {
      Object user = OneSignal.class.getMethod("getUser").invoke(null);
      ret.put("hasUser", user != null);

      if (user != null) {
        try {
          Object externalId = user.getClass().getMethod("getExternalId").invoke(user);
          ret.put("externalId", externalId != null ? String.valueOf(externalId) : null);
        } catch (Throwable t) {
          ret.put("externalId", null);
        }

        Object pushSub = null;
        try {
          pushSub = user.getClass().getMethod("getPushSubscription").invoke(user);
        } catch (Throwable t) {
        }

        ret.put("hasPushSubscription", pushSub != null);
        if (pushSub != null) {
          ret.put("pushId", invokeToString(pushSub, "getId"));
          ret.put("token", invokeToString(pushSub, "getToken"));
          ret.put("optedIn", invokeToBoolean(pushSub, "getOptedIn"));
          ret.put("subscribed", invokeToBoolean(pushSub, "getSubscribed"));
        }
      }
    } catch (Throwable t) {
      ret.put("error", t.getMessage() != null ? t.getMessage() : "debugState_failed");
    }

    call.resolve(ret);
  }

  private String invokeToString(Object target, String method) {
    try {
      Object v = target.getClass().getMethod(method).invoke(target);
      return v != null ? String.valueOf(v) : null;
    } catch (Throwable t) {
      return null;
    }
  }

  private Boolean invokeToBoolean(Object target, String method) {
    try {
      Object v = target.getClass().getMethod(method).invoke(target);
      if (v == null) return null;
      if (v instanceof Boolean) return (Boolean) v;
      return Boolean.valueOf(String.valueOf(v));
    } catch (Throwable t) {
      return null;
    }
  }
}
