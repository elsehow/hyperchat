import h from 'virtual-dom/h';
import remark from 'remark';
import hljs from 'remark-highlight.js';
import vdom from 'remark-vdom';
import _ from 'lodash';

import dispatcher from './dispatcher.js';
import validate from './validate.js';

function vdomify(markdown) {
  return remark().use([hljs, vdom]).process(markdown)
}

let editingIdentity = false;

function shownName(name) {
  return name ? name : 'Anonymous';
}

// messages that are not replies to anything
// sorted newest first
function topLevelFeed(messages) {
  return _
    .chain(messages)
    .filter(d => !d.value.replyTo)
    .sortBy('change')
    .reverse()
    .value()
}

// get replies to `messageID`
// sorted newest last
function repliesTo(messageID, messages) {
  return _
    .chain(messages)
    .filter(d => d.value.replyTo === messageID)
    .sortBy('change')
    .value()
}



function render(state) {

  // get top-level message feed
  let ms = topLevelFeed(state.messages)
  
  // header
  return h('div', [
    h('div.top-matter', [
      // board identitiy
      header(),
      // user identity
      identity(),
    ]),
    // messageboard
    h('div.messageboard', [
      // global post box
      postInput(null, 'global-input'),
      // posts, including their replies + reply inputs
      h('div.thread', ms.map(_.partial(messageV, 0, 1))),
    ]),
  ])

  // helper functions
  // board name
  function header() {
    return h('div.board-header', [
      h('h3', state.boardName),
      h('pre', state.keys.id),
    ])
  }

  function identity() {
    function toggleEditing(val) {
      if (val)
        editingIdentity = val
      else
        editingIdentity = !editingIdentity;
      dispatcher.emit('update', state)
    }
    return h('div.identity-header', [
      'you are known as ',
      h('button', {
        onclick: toggleEditing,
        style: {
          visibility: editingIdentity ? "hidden" : "visible"
        },
      }, shownName(state.pseudonym)),
      h('input', {
        value: state.pseudonym,
        onchange: ev => {
          dispatcher.emit('change-pseudonym', ev.target.value)
        },
        onblur: (_) => {
          toggleEditing(false)
        },
        style: {
          visibility: editingIdentity ? "visible" : "hidden"
        },
      })
    ])
  }

  function postInput(messageKey, className) {

    let buttonText = 'reply'

    if (!messageKey)
      buttonText = `post (as ${shownName(state.pseudonym)})`

    function sendMyMessage() {
      const txt = state.inputs[messageKey]
      if (validate(txt)) {
        dispatcher.emit('send-message', messageKey, txt)
      } 
      else { }
    }

    return h('div', [
      h('textarea', {
        className: className,
        value: state.inputs[messageKey],
        // update input value on keyup
        onchange: (ev) => {
          dispatcher.emit('edit-input', messageKey, ev.target.value)
        },
      }),
      h('button', {
        onclick: sendMyMessage,
        //disabled: !validate(state.inputs[messageKey]),
        style: {
          float: 'right',
        }
      }, buttonText)
    ])
  }


  function messageV(indent, max, m) {
    // get list of messages that are a reply to this message
    let rs = repliesTo(m.key, state.messages)
    let childMessageV = _.partial(messageV, indent + 1, max)

    // if we're not yet at max
    // show replies, and an input box
    let replies = [];
    let input = [];
    if (indent < max) {
      replies = h('div', rs.map(childMessageV))
      input = postInput(m.key, 'reply')
    }

    return h('div', [
      // message pseudonym
      h('small', shownName(m.value.pseudonym)),
      // message markdown => hyperscript
      vdomify(m.value.message),
      h('div.replies', {
          style: {
            'margin-left': 20 * (indent + 1) + 'px',
          },
        }, [
          // list of replies to message
          replies,
          // input to reply to comment
          input,
      ])
    ])
  }
}


export default render;
