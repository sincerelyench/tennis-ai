package app.zhangqiu;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import com.tencent.mm.opensdk.modelbase.BaseResp;
import com.tencent.mm.opensdk.modelmsg.SendAuth;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;

/**
 * WeChat OpenSDK SendAuth helper for the WebView shell.
 * When {@link BuildConfig#WECHAT_APP_ID} is empty or WeChat is missing, falls
 * back to a stable {@code apk_&lt;androidId&gt;} code handled by /api/auth/wechat.
 */
public final class WeChatAuth {
    private static final String TAG = "WeChatAuth";
    private static final String WECHAT_PACKAGE = "com.tencent.mm";

    public interface Callback {
        void onCode(String code);

        void onError(String message);
    }

    private static volatile Callback pending;
    private static IWXAPI api;

    private WeChatAuth() {
    }

    public static synchronized IWXAPI ensureApi(Context context) {
        if (api == null) {
            String appId = BuildConfig.WECHAT_APP_ID == null ? "" : BuildConfig.WECHAT_APP_ID.trim();
            api = WXAPIFactory.createWXAPI(context.getApplicationContext(), appId, false);
            if (!TextUtils.isEmpty(appId)) {
                api.registerApp(appId);
            }
        }
        return api;
    }

    public static boolean hasAppId() {
        return BuildConfig.WECHAT_APP_ID != null && !BuildConfig.WECHAT_APP_ID.trim().isEmpty();
    }

    public static boolean isWeChatInstalled(Context context) {
        try {
            context.getPackageManager().getPackageInfo(WECHAT_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ex) {
            return false;
        }
    }

    public static String fallbackCode(Context context) {
        String androidId = Settings.Secure.getString(
                context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.trim().isEmpty()) {
            androidId = "unknown";
        }
        return "apk_" + androidId.trim();
    }

    public static void start(Activity activity, Callback callback) {
        pending = callback;
        if (!hasAppId() || !isWeChatInstalled(activity)) {
            Log.i(TAG, "fallback mock code (appId empty or WeChat missing)");
            deliverCode(fallbackCode(activity));
            return;
        }
        try {
            IWXAPI wx = ensureApi(activity);
            SendAuth.Req req = new SendAuth.Req();
            req.scope = "snsapi_userinfo";
            req.state = "zhangqiu_login_" + System.currentTimeMillis();
            boolean ok = wx.sendReq(req);
            if (!ok) {
                Log.w(TAG, "sendReq failed; using fallback");
                deliverCode(fallbackCode(activity));
            }
        } catch (Exception ex) {
            Log.e(TAG, "OpenSDK error", ex);
            deliverCode(fallbackCode(activity));
        }
    }

    public static void onResp(BaseResp resp) {
        if (resp == null) {
            deliverError("empty wechat response");
            return;
        }
        if (resp instanceof SendAuth.Resp) {
            SendAuth.Resp auth = (SendAuth.Resp) resp;
            if (auth.errCode == BaseResp.ErrCode.ERR_OK && !TextUtils.isEmpty(auth.code)) {
                deliverCode(auth.code);
                return;
            }
            if (auth.errCode == BaseResp.ErrCode.ERR_USER_CANCEL) {
                deliverError("cancelled");
                return;
            }
            deliverError("wechat err=" + auth.errCode);
            return;
        }
        deliverError("unexpected wechat response");
    }

    private static void deliverCode(String code) {
        Callback cb = pending;
        pending = null;
        if (cb != null) {
            cb.onCode(code);
        }
    }

    private static void deliverError(String message) {
        Callback cb = pending;
        pending = null;
        if (cb != null) {
            cb.onError(message == null ? "wechat error" : message);
        }
    }
}
