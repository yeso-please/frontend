// 릴리스 빌드에서도 카카오 지도 웹뷰가 뜨게 합니다.
// 지도 웹뷰의 출처(EXPO_PUBLIC_KAKAO_MAP_ORIGIN)가 카카오에 등록된 http://localhost:8080 이라서, 카카오 지도 SDK가
// 페이지 주소를 따라 본체 스크립트·지도 타일을 http로 받습니다. 릴리스 빌드는 http를 막아 지도가 아예 뜨지 않습니다.
// 그래서 카카오 지도 도메인에만 http를 허용합니다 (앱의 API·그 밖의 주소는 계속 https만).
// 카카오 디벨로퍼스에 https 도메인(CloudFront 주소)을 등록하고 출처를 https로 바꾸면 이 플러그인은 지워도 됩니다.
// 디버그 빌드는 Metro·로컬 백엔드 때문에 모든 http를 허용합니다 (src/debug 리소스가 같은 이름 파일을 덮어씀).
const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const KAKAO_MAP_DOMAINS = ["daumcdn.net", "kakao.com", "kakaocdn.net", "daum.net"];

const releaseConfig = `<?xml version="1.0" encoding="utf-8"?>
<!-- withKakaoMapCleartext 플러그인이 만듭니다. 카카오 지도 도메인만 http 허용 -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
${KAKAO_MAP_DOMAINS.map((d) => `    <domain includeSubdomains="true">${d}</domain>`).join("\n")}
  </domain-config>
</network-security-config>
`;

const debugConfig = `<?xml version="1.0" encoding="utf-8"?>
<!-- withKakaoMapCleartext 플러그인이 만듭니다. 디버그는 Metro·로컬 서버 때문에 모든 http 허용 -->
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

module.exports = function withKakaoMapCleartext(config) {
  config = withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return c;
  });
  return withDangerousMod(config, [
    "android",
    async (c) => {
      for (const [variant, xml] of [
        ["main", releaseConfig],
        ["debug", debugConfig],
      ]) {
        const dir = path.join(c.modRequest.platformProjectRoot, "app", "src", variant, "res", "xml");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "network_security_config.xml"), xml);
      }
      return c;
    },
  ]);
};
