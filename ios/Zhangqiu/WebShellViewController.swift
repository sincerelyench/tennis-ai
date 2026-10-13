import UIKit
import WebKit

/// Thin WKWebView shell around the existing /e1 upload flow.
/// Analysis stays on the current backend; this controller does not reimplement it.
final class WebShellViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let startURL: URL
    private var webView: WKWebView!
    private var showingError = false
    private var loadingErrorPage = false
    private var provisionalURL: URL?
    private var recoveringFromCrash = false

    init() {
        let raw = ShellConfig.resolveStartURL()
        self.startURL = URL(string: raw) ?? URL(string: ShellConfig.defaultStartURL)!
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = ShellTheme.background

        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = "ZhangqiuIOS/1"
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        let script = WKUserScript(
            source: ShellConfig.fileInputStyleScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(script)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = ShellTheme.background
        webView.underPageBackgroundColor = ShellTheme.background
        webView.scrollView.backgroundColor = ShellTheme.background
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
        ])
        self.webView = webView
        webView.load(URLRequest(url: startURL))
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        if navigationAction.targetFrame?.isMainFrame == true {
            provisionalURL = navigationAction.request.url
            if let scheme = provisionalURL?.scheme?.lowercased(), scheme == "http" || scheme == "https" {
                loadingErrorPage = false
            }
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        if loadingErrorPage { return }
        let url = provisionalURL ?? webView.url
        if let scheme = url?.scheme?.lowercased(), scheme == "http" || scheme == "https" {
            showingError = false
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        recoveringFromCrash = false
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        if navigationResponse.isForMainFrame,
           let http = navigationResponse.response as? HTTPURLResponse,
           http.statusCode >= 400 {
            decisionHandler(.cancel)
            showLoadError()
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if recoveringFromCrash {
            showLoadError()
            return
        }
        recoveringFromCrash = true
        showingError = false
        webView.reload()
    }

    /// `<input type="file">` uses WKWebView's built-in picker, including the
    /// camera path for `capture="environment"`. Info.plist carries the camera,
    /// microphone, and photo-library prompts that picker needs. The injected
    /// style keeps the page's visually hidden file input able to open it.
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    private func handleFailure(_ error: Error) {
        if showingError { return }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return
        }
        showLoadError()
    }

    private func showLoadError() {
        if showingError || webView == nil { return }
        showingError = true
        loadingErrorPage = true
        webView.loadHTMLString(ShellConfig.errorHTML(retryURL: startURL.absoluteString), baseURL: nil)
    }
}
