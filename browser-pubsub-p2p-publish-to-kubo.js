import { createLibp2p } from "libp2p";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { mplex } from "@libp2p/mplex";
import { yamux } from "@chainsafe/libp2p-yamux";
import { noise } from "@chainsafe/libp2p-noise";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { dcutr } from "@libp2p/dcutr";
import { ping } from '@libp2p/ping'
import { webTransport } from "@libp2p/webtransport";
import {
  toString as uint8ArrayToString,
  fromString as uint8ArrayFromString,
} from "uint8arrays";
import { bootstrap } from "@libp2p/bootstrap";
import { identify as identifyService } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { createEd25519PeerId } from "@libp2p/peer-id-factory";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { autoNAT } from "@libp2p/autonat";
// From https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.ts
const bootstrapConfig = {
  list: [
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
    "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
    "/dns4/wrtc-star.discovery.libp2p.io/tcp/443/wss/p2p-webrtc-star",
    "/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star",
    "/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star",
  ],
};

const log = (...args) => {
  console.log(...args);
  const logHtml = (...args) => {
    const p = document.createElement("p");
    let textContent = "";
    for (const [i, arg] of args.entries()) {
      if (textContent !== "") {
        textContent += " ";
      }
      if (typeof arg === "object") {
        textContent += JSON.stringify(arg, null, 2);
        if (args.length - 1 !== i) {
          textContent += "\n";
        }
      } else {
        textContent += arg;
      }
    }
    p.textContent = textContent;
    p.style.whiteSpace = "pre";
    document.body.prepend(p);
  };
  try {
    if (document.readyState !== "complete") {
      window.addEventListener("load", () => logHtml(...args));
    } else {
      logHtml(...args);
    }
  } catch (e) {}
};

const logEvents = (nodeName, node) => {
  const events = [
    "connection:close",
    "connection:open",
    "connection:prune",
    "peer:connect",
    "peer:disconnect",
    "peer:discovery",
    "peer:identify",
    "peer:update",
    "self:peer:update",
    "start",
    "stop",
    "transport:close",
    "transport:listening",
  ];
  const logEvent = (event) => log(nodeName, event.type, event.detail);
  events.forEach((event) => node.addEventListener(event, logEvent));
};

(async () => {
  try {
    const peerId = await createEd25519PeerId();
    /** @type {import('libp2p').Libp2pOptions} */
    const browserNode = await createLibp2p({
      // can't listen using webtransport in libp2p js
      // addresses: {listen: []},
      addresses: {
        listen: ["/webrtc"],
      },
      peerDiscovery: [bootstrap(bootstrapConfig)],
      peerId,
      transports: [
        circuitRelayTransport({
          discoverRelays: 1,
        }),
        webRTC(),
        webRTCDirect(),
        webTransport(),
        webSockets(),
      ],
      streamMuxers: [yamux(), mplex()],
      connectionEncryption: [noise()],
      connectionGater: {
        // not sure why needed, doesn't connect without it
        // denyDialMultiaddr: async () => false
      },
      // connectionManager: {
      //   maxConnections: 10,
      //   minConnections: 5,
      // },
      services: {
        dcutr: dcutr(),
        identify: identifyService(), // required for peer discovery of pubsub
        dht: kadDHT({ clientMode: true }), // p2p peer discovery
        pubsub: gossipsub({
          allowPublishToZeroPeers: true,
        }),
        autoNAT: autoNAT(),
        ping: ping()
      },
      
    });
    logEvents("browser-node", browserNode);

    // log addresses
    log("browser-node", browserNode.getMultiaddrs());

    const topic = "sub-test-123"; // for testing purposes

    // sub
    browserNode.services.pubsub.addEventListener("message", (evt) => {
      log(
        `browserNode: ${evt.detail.from}: ${uint8ArrayToString(
          evt.detail.data
        )} on topic ${evt.detail.topic}`
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for libp2p
    browserNode.services.pubsub.subscribe(topic);

    const res = await browserNode.services.pubsub.publish(
      topic,
      uint8ArrayFromString("hello from browser p2p")
    );

    log(`browser node published to topic (${topic}) and result is `, res);

    setInterval(async () => {
      try {
        const res = await browserNode.services.pubsub.publish(
          topic,
          uint8ArrayFromString("hello from browser p2p")
        );

        log(`browser node published to topic (${topic}) and result is `, res);
      } catch (e) {
        console.error(e);
      }
    }, 5000);
  } catch (e) {
    log(e);
    log(e.stack);
  }
})();
