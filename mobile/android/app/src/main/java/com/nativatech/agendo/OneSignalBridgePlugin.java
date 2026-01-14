package com.nativatech.agendo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.onesignal.OneSignal;

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
      OneSignal.logout();
      JSObject ret = new JSObject();
      ret.put("ok", true);
      call.resolve(ret);
    } catch (Throwable t) {
      call.reject(t.getMessage() != null ? t.getMessage() : "OneSignal.logout failed");
    }
  }
}
