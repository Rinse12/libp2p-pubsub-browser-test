import { createLibp2p } from 'libp2p'
import { peerIdFromString } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webTransport } from '@libp2p/webtransport'
import { mplex } from '@libp2p/mplex'
import { yamux } from '@chainsafe/libp2p-yamux'
import { noise } from '@chainsafe/libp2p-noise'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { bootstrap } from '@libp2p/bootstrap'
import { identifyService } from 'libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'

const log = (...args) => {
    console.log(...args)
    const logHtml = (...args) => {
        const p = document.createElement('p')
        let textContent = ''
        for (const [i, arg] of args.entries()) {
            if (textContent !== '') {
                textContent += ' '
            }
            if (typeof arg === 'object') {
                textContent += JSON.stringify(arg, null, 2)
                if (args.length - 1 !== i) {
                    textContent += '\n'
                }
            }
            else {
                textContent += arg
            }
        }
        p.textContent = textContent
        p.style.whiteSpace = 'pre'
        document.body.prepend(p)
    }
    try {
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => logHtml(...args))
        }
        else {
            logHtml(...args)
        }
    }
    catch (e) {}
}

const logEvents = (nodeName, node) => {
    const events = [
        'connection:close',
        'connection:open',
        'connection:prune',
        'peer:connect',
        'peer:disconnect',
        'peer:discovery',
        'peer:identify',
        'peer:update',
        'self:peer:update',
        'start',
        'stop',
        'transport:close',
        'transport:listening',
    ]
    const logEvent = (event) => log(nodeName, event.type, event.detail)
    events.forEach(event => node.addEventListener(event, logEvent))
}

let peerId, peerMultiAddress
try {
    // example: /demo4.html?/ip4/0.0.0.0/udp/36338/quic-v1/webtransport/certhash/uEiAKYNN-nS53kXTQTzM0__ksuMI9mEczZA9YbNyyth-NLw/certhash/uEiD9Ja-UEHkuLjtaVKX7D1wZVri6GKkrmxFOue8-9YMAzg/p2p/Qmbi4zsa9H8WDZk8akwSiBqEe8U1Gedh8Mh4R4aCfR3Twx 
    peerMultiAddress = location.search.replace(/^\?/, '')
    peerId = peerMultiAddress.split('/p2p/')[1]
}
catch (e) {
    log(e)
}
if (!peerId || !peerMultiAddress) {
    log('failed to get peer to connect to from query string, example: /demo4.html?/ip4/0.0.0.0/udp/36338/quic-v1/webtransport/certhash/uEiAKYNN-nS53kXTQTzM0__ksuMI9mEczZA9YbNyyth-NLw/certhash/uEiD9Ja-UEHkuLjtaVKX7D1wZVri6GKkrmxFOue8-9YMAzg/p2p/Qmbi4zsa9H8WDZk8akwSiBqEe8U1Gedh8Mh4R4aCfR3Twx')
}

;(async () => {
try {

// bootstrap node is created in go because listening on webTransport is not implemented in libp2p js
const bootstrapNode = {
    peerId: peerIdFromString(peerId),
    getMultiaddrs: () => [multiaddr(peerMultiAddress)]
}

const createNode2 = async () => {
    const peerId = await createEd25519PeerId();
    const libP2pNode = await createLibp2p({
        // can't listen using webtransport in libp2p js
        // addresses: {listen: []},
        
        peerDiscovery: [bootstrap(bootstrapConfig)],
        peerId,
        transports: [
            webTransport(),
            webRTCDirect(),
            circuitRelayTransport() // TODO: test this later, probably need to upgrade libp2p
        ],
        streamMuxers: [yamux(), mplex()],
        connectionEncryption: [noise()],
        connectionGater: {
            // not sure why needed, doesn't connect without it
            // denyDialMultiaddr: async () => false
        },
        connectionManager: {
            maxConnections: 10,
            minConnections: 5
        },
        services: {
            identify: identifyService(), // required for peer discovery of pubsub
            dht: kadDHT({}), // p2p peer discovery
            pubsub: gossipsub({
                allowPublishToZeroPeers: true
            }),
            nat: autoNAT()
        },
    });
    logEvents('node2', libP2pNode)
    return libP2pNode
}
const node2 = await createNode2()

// log addresses
log('bootstrapNode', bootstrapNode.getMultiaddrs(), 'node2', node2.getMultiaddrs())

const topic = 'demo'

// sub
node2.services.pubsub.addEventListener('message', (evt) => {
    log(`node2: ${evt.detail.from}: ${uint8ArrayToString(evt.detail.data)} on topic ${evt.detail.topic}`)
})
await node2.services.pubsub.subscribe(topic)

// pub
setInterval(() => {
  node2.services.pubsub.publish(topic, uint8ArrayFromString('demo message from node 2')).catch(err => {
    console.error(err)
  })
}, 1000)

} catch (e) {
    log(e.stack)
}
})()
