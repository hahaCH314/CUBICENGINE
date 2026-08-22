import UIKit
import Capacitor

/// WebView を「安全な範囲」に収めるための入れ物。
///
/// なぜ要るか:
///   Capacitor の CAPBridgeViewController は `view = webView` として WebView 自身を
///   画面全体に敷く。そのため iPhone では時計・Dynamic Island・ホームバーの下に
///   ページが潜り込み、ヘッダーの文字やボタンが隠れる。
///
///   Android 版は @capawesome/capacitor-android-edge-to-edge-support が
///   まったく同じ問題を「WebView に余白を入れて、余った帯を塗る」ことで解決している。
///   iOS には同等のプラグインが無いので、ここで手作業で同じことをする。
///
/// ⚠️ 帯の色は capacitor.config.ts の EdgeToEdge.backgroundColor と揃えること。
///    片方だけ変えると Android と iOS で上下の色が食い違う。
///    （globals.css の --background = #404044 が大元）
final class SafeAreaHostViewController: UIViewController {
    /// 上下に塗る色。#404044 = globals.css の --background。
    private static let barColor = UIColor(red: 0x40 / 255.0, green: 0x40 / 255.0, blue: 0x44 / 255.0, alpha: 1)

    private let content = CAPBridgeViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.barColor

        addChild(content)
        content.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(content.view)
        NSLayoutConstraint.activate([
            content.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            content.view.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            content.view.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            content.view.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])
        content.didMove(toParent: self)
    }

    // ステータスバーの見え方は中の WebView 側の判断に任せる。
    override var childForStatusBarStyle: UIViewController? { content }
    override var childForStatusBarHidden: UIViewController? { content }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // ⚠️ CAPBridgeViewController を直接 root にしない（Capacitor の初期状態）。
        //    直接置くと画面が時計やホームバーと重なる。上のクラスの説明を参照。
        window?.rootViewController = SafeAreaHostViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
