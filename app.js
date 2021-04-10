'use strict';
var stats = {};
var playerTable = {};
var O = othello;
var NoChessPlaced = { x: -1, y: -1 };

// UI {{{1

function drawGameBoard(board, player, moves, currentChess) {
  var ss = [];
  var attackable = [];
  moves.forEach(function (m) {
    if (!m.isPassingMove)
      attackable[O.ix(m.x, m.y)] = true;
  });

  ss.push('<table>');
  for (var y = -1; y < O.N; y++) {
    ss.push('<tr>');
    for (var x = -1; x < O.N; x++) {
      if (0 <= y && 0 <= x) {
        ss.push('<td class="');
        ss.push('cell');
        ss.push(' ');
        ss.push(attackable[O.ix(x, y)] ? player : board[O.ix(x, y)]);
        ss.push(' ');
        ss.push(attackable[O.ix(x, y)] ? 'attackable' : '');
        ss.push('" id="');
        ss.push('cell_' + x + '_' + y);
        ss.push('">');
        ss.push('<span class="disc');
        if (currentChess.x == x && currentChess.y == y) {
          ss.push(' newest');
        }
        ss.push('"></span>');
        ss.push('</td>');
      } else if (0 <= x && y === -1) {
        ss.push('<th>' + String.fromCharCode('a'.charCodeAt(0)+x) + '</th>');
      } else if (x === -1 && 0 <= y) {
        ss.push('<th>' + (y + 1) + '</th>');
      } else /* if (x === -1 && y === -1) */ {
        ss.push('<th></th>');
      }
    }
    ss.push('</tr>');
  }
  ss.push('</table>');

  $('#game-board').html(ss.join(''));
  $('#current-player-name').text(player);
}

function resetUI() {
  $('#console').empty();
  $('#message').empty();
}

function setUpUIToChooseMove(gameTree) {
  $('#message').text('Choose your move.');
  gameTree.moves.forEach(function (m, i) {
    if (m.isPassingMove) {
      $('#console').append(
        $('<input type="button" class="btn">')
        .val(O.nameMove(m))
        .click(function () {
          shiftToNewGameTree(O.force(m.gameTreePromise), NoChessPlaced);
        })
      );
    } else {
      $('#cell_' + m.x + '_' + m.y)
      .click(function () {
        shiftToNewGameTree(O.force(m.gameTreePromise), {x: m.x, y: m.y});
      });
    }
  });
}

function setUpUIToReset() {
  resetGame();
  if ($('#repeat-games:checked').length)
    startNewGame();
}

var minimumDelayForAI = 500;  // milliseconds
function chooseMoveByAI(gameTree, ai) {
  $('#message').text('Now thinking...');
  setTimeout(
    function () {
      var start = Date.now();
      var move = ai.findTheBestMove(gameTree);
      var newGameTree = O.force(move.gameTreePromise);
      var end = Date.now();
      var delta = end - start;
      setTimeout(
        function () {
          shiftToNewGameTree(newGameTree, {x: move.x, y: move.y});
        },
        Math.max(minimumDelayForAI - delta, 1)
      );
    },
    1
  );
}

function showWinner(board) {
  var r = O.judge(board);
  $('#message').text(
    r === 0 ?
    'The game ends in a draw.' :
    'The winner is ' + (r === 1 ? O.BLACK : O.WHITE) + '.'
  );
}

function makePlayer(playerType) {
  if (playerType === 'human') {
    return setUpUIToChooseMove;
  } else {
    var ai = O.makeAI(playerType);
    return function (gameTree) {
      chooseMoveByAI(gameTree, ai);
    };
  }
}

function blackPlayerType() {
  return $('#black-player-type').val();
}

function whitePlayerType() {
  return $('#white-player-type').val();
}

function swapPlayerTypes() {
  var t = $('#black-player-type').val();
  $('#black-player-type').val($('#white-player-type').val()).change();
  $('#white-player-type').val(t).change();
}

function shiftToNewGameTree(gameTree, currentChess) {
  stats.gameHistory[stats.step] = gameTree;
  ++stats.step;
  drawGameBoard(gameTree.board, gameTree.player, gameTree.moves, currentChess);
  resetUI();
  if (gameTree.moves.length === 0) {
    showWinner(gameTree.board);
    recordStat(gameTree.board);
    if ($('#repeat-games:checked').length)
      showStat();
    setUpUIToReset();
  } else {
    playerTable[gameTree.player](gameTree);
  }
}

function rollbackToStep(targetStep) {
  var newGameHistory = stats.gameHistory.slice(0, targetStep);
  var newGameTree = stats.gameHistory[targetStep];
  stats.gameHistory = newGameHistory;
  stats.step = targetStep;
  shiftToNewGameTree(newGameTree, NoChessPlaced)
}

function rollbackOneStep() {
  // stats.step represent the next chess to place, we need reverse to rollbackStepNumber + 1.
  if (blackPlayerType() === 'human' && whitePlayerType() === 'human') {
    // In all human game, we only need to rollback one step
    if (stats.step >= 2) {
      rollbackToStep(stats.step - 2);
    }
  } else {
    // Rollback AI step doesn't make any sense, so we rollback the last two step (oppenent and myself), step should -3.
    if (stats.step >= 3) {
      rollbackToStep(stats.step - 3);
    }
  }
}

function recordStat(board) {
  var s = stats[[blackPlayerType(), whitePlayerType()]] || {b: 0, w: 0, d: 0};
  var r = O.judge(board);
  if (r === 1)
    s.b++;
  if (r === 0)
    s.d++;
  if (r === -1)
    s.w++;
  stats[[blackPlayerType(), whitePlayerType()]] = s;
}

function showStat() {
  var s = stats[[blackPlayerType(), whitePlayerType()]];
  $('#stats').text('Black: ' + s.b + ', White: ' + s.w + ', Draw: ' + s.d);
}

function resetGame() {
  $('#preference-pane :input:not(#repeat-games)')
    .removeClass('disabled')
    .removeAttr('disabled');
}

function startNewGame() {
  $('#preference-pane :input:not(#repeat-games)')
    .addClass('disabled')
    .attr('disabled', 'disabled');
  playerTable[O.BLACK] = makePlayer(blackPlayerType());
  playerTable[O.WHITE] = makePlayer(whitePlayerType());
  stats.step = 0;
  stats.gameHistory = [];
  var newGameTree = O.makeInitialGameTree(placeBarrier);
  shiftToNewGameTree(newGameTree, NoChessPlaced);
}

function placeBarrier(board) {
  var barrierType = $('input[name="barrier-type"]:checked').val();
  console.log('Your barrier type: ' + barrierType);
  if (barrierType === "random-barrier") {
    var barrierNumberInput = $('#random-barrier-number').val();
    var barrierNumber = parseInt(barrierNumberInput);
    console.log('Your random barrier number input: ' + barrierNumberInput);
    var boardSize = O.N * O.N;
    var barrierDumpString = '';
    for (var i = 0; i < barrierNumber; ++i) {
      var nextBarrierLocation = Math.floor(Math.random() * boardSize);
      for (; board[nextBarrierLocation] != O.EMPTY; nextBarrierLocation = Math.floor(Math.random() * boardSize)) {}
      var row = Math.floor(nextBarrierLocation / O.N) + 1;
      var col = 'abcdefgh'[(nextBarrierLocation % O.N)];
      console.log('Your #' + i + ' random barrier location: ' + row + col);
      barrierDumpString += '' + row + col + ',';
      board[nextBarrierLocation] = O.BARRIER;
    }
    console.log('Your barrier dump string: ' + barrierDumpString);
  } else if (barrierType === "specific-barrier") {
    var barrierLocationInput = $('#barrier-location').val();
    console.log('Your barrier location input: ' + barrierLocationInput);
    var locationStrings = barrierLocationInput.split(',');
    locationStrings.forEach(function (locationString) {
      var row = parseInt(locationString.replace(/\D/g, '')) - 1;
      var col = locationString.replace(/\d+/g, '').charCodeAt(0) - 97;
      var barrierLocation = O.ix(col, row);
      if (board[barrierLocation] === O.EMPTY) {
        board[barrierLocation] = O.BARRIER;
      }
    });
  }
}



  // Startup {{{1
(function (O) {
  'use strict';

  $('#start-button').click(function () {startNewGame();});
  $('#add-new-ai-button').click(function () {O.addNewAI();});
  $('#swap-player-types-button').click(function () {swapPlayerTypes();});
  $('#rollback-one-step-button').click(function () {rollbackOneStep();});
  resetGame();
  drawGameBoard(O.makeInitialGameBoard(), '-', [], NoChessPlaced);

  //}}}
})(othello);
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
