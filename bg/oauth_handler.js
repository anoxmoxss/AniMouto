const isChrome = typeof InstallTrigger === 'undefined';
const clientId = isChrome ? 1387 : 1336;
const redirectUri = isChrome ? chrome.identity.getRedirectURL("oauth") : "https://anilist.co/api/v2/oauth/pin";
const authUrl = "https://anilist.co/api/v2/oauth/authorize?client_id=" + clientId + "&response_type=token";

function beginAuthorizationFlow() {
  console.log("Beginning AniList authentication");
  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, redirect_url => {
    if (chrome.runtime.lastError) {
      console.debug(chrome.runtime.lastError);
    } else {
      if (isChrome) {
        console.log("Authentication code recieved, trading for token.");
        let token = redirect_url.split("#")[1].split("&")[0].split("=")[1];
        handleToken(token);
      } else {
        console.log("Authentication code recieved, awaiting user input.");
      }
    }
  });
}

function handleToken(token) {
  chrome.storage.local.set({ access_token: token });
  console.log("Token obtained and stored.");

  console.log("Requesting basic user information.");
  fetch("../graphql/viewer.graphql").then(query => query.text()).then(query => {
    queryAL(query, {}, token).then(viewerRes => viewerRes.json())
    .then(viewerRes => viewerRes.data.Viewer)
    .then(viewerRes => {
      completeLogin(viewerRes);
    });
  });
}

function validateToken(token) {
  fetch("../graphql/viewer.graphql").then(query => query.text()).then(query => {
    queryAL(query, {}, token).then(viewerRes => viewerRes.json())
      .then(res => {
        if (res.errors) {
          console.log("Invalid token provided.");
          chrome.runtime.sendMessage({ type: "display_toast", toast: { type: "burnt", text: "Invalid authentication code" } })
          chrome.runtime.sendMessage({ type: "login_failure" });
        } else {
          chrome.storage.local.set({ access_token: token });
          console.log("Token obtained and stored.");
          completeLogin(res.data.Viewer);
        }
      })
  });
}

function completeLogin(viewer) {
  chrome.storage.local.set({ user_info: { name: viewer.name, id: viewer.id, site_url: viewer.siteUrl, avatar: viewer.avatar.large } });
  chrome.runtime.sendMessage({ type: "change_avatar", avatar: viewer.avatar.large });
  chrome.runtime.sendMessage({ type: "change_page", page: "medialist" });
}
