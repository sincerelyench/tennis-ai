package app.zhangqiu;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Thin shell around the existing web upload flow at /e1.
 * Analysis stays on the current backend; this activity does not reimplement it.
 */
public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 4101;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private boolean showingError;
    private String startUrl = "";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startUrl = resolveStartUrl();
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#07140e"));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " ZhangqiuAndroid/1");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                Intent intent = params.createIntent();
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(intent, FILE_CHOOSER);
                } catch (ActivityNotFoundException ex) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    showingError = false;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request == null || !request.isForMainFrame() || showingError) return;
                showingError = true;
                view.loadDataWithBaseURL(null, errorHtml(), "text/html", "utf-8", null);
            }
        });
        setContentView(webView);
        webView.loadUrl(startUrl);
    }

    private String resolveStartUrl() {
        String extra = getIntent() == null ? null : getIntent().getStringExtra("start_url");
        String url = extra == null || extra.trim().isEmpty() ? getString(R.string.start_url) : extra.trim();
        if (!(url.startsWith("http://") || url.startsWith("https://"))) {
            return getString(R.string.start_url);
        }
        return url;
    }

    private String errorHtml() {
        String retry = startUrl == null ? "" : startUrl.replace("&", "&amp;").replace("\"", "&quot;");
        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>"
                + "<style>body{margin:0;padding:28px;background:#07140e;color:#eef6ee;font-family:sans-serif}"
                + "a{color:#d6e35a}</style></head><body>"
                + "<h1>涨球</h1>"
                + "<p>打不开页面。请先在电脑上启动后端，并确认地址能从这台设备访问。</p>"
                + "<p>Could not open the page. Start the local server, then confirm this device can reach it.</p>"
                + "<p><a href=\"" + retry + "\">重试 / Retry</a></p>"
                + "</body></html>";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        Uri[] uris = null;
        if (resultCode == RESULT_OK) {
            uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        }
        fileCallback.onReceiveValue(uris);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
