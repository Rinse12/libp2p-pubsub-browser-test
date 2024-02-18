import { createLibp2p } from "libp2p";
import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { webTransport } from "@libp2p/webtransport";
import { mplex } from "@libp2p/mplex";
import { yamux } from "@chainsafe/libp2p-yamux";
import { noise } from "@chainsafe/libp2p-noise";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { bootstrap } from "@libp2p/bootstrap";
import { identifyService } from "libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";

// From https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.ts
const bootstrapConfig = {
  list: [
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
    "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
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

    const browserNode = await createLibp2p({
      // can't listen using webtransport in libp2p js
      // addresses: {listen: []},

      peerDiscovery: [bootstrap(bootstrapConfig)],
      peerId,
      transports: [
        webTransport(),
        webRTCDirect(),
        circuitRelayTransport(), // TODO: test this later, probably need to upgrade libp2p
      ],
      streamMuxers: [yamux(), mplex()],
      connectionEncryption: [noise()],
      connectionGater: {
        // not sure why needed, doesn't connect without it
        // denyDialMultiaddr: async () => false
      },
      connectionManager: {
        maxConnections: 10,
        minConnections: 5,
      },
      services: {
        identify: identifyService(), // required for peer discovery of pubsub
        dht: kadDHT({}), // p2p peer discovery
        pubsub: gossipsub({
          allowPublishToZeroPeers: true,
        }),
        nat: autoNAT(),
      },
    });
    logEvents("browser-node", libP2pNode);

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
    browserNode.services.pubsub.subscribe(topic);

    const res = await browserNode.services.pubsub.publish(
      topic,
      uint8ArrayFromString("hello from browser p2p")
    );
    log(`browser node published to topic (${topic}) and result is `, res);
  } catch (e) {
    log(e);
    log(e.stack);
  }
})();
