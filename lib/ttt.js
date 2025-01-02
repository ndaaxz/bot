// Fungsi untuk merender papan Tic Tac Toe
export function renderBoard(board) {
    return board.map(row => row.join(" | ")).join("\n---------\n");
  }
  
  // Fungsi untuk mengecek pemenang
  export function checkWinner(board) {
    const lines = [
      // Baris
      [board[0][0], board[0][1], board[0][2]],
      [board[1][0], board[1][1], board[1][2]],
      [board[2][0], board[2][1], board[2][2]],
      // Kolom
      [board[0][0], board[1][0], board[2][0]],
      [board[0][1], board[1][1], board[2][1]],
      [board[0][2], board[1][2], board[2][2]],
      // Diagonal
      [board[0][0], board[1][1], board[2][2]],
      [board[0][2], board[1][1], board[2][0]],
    ];
  
    for (const line of lines) {
      if (line[0] === line[1] && line[1] === line[2]) {
        return line[0];
      }
    }
    return null;
  }
  
  // Fungsi untuk mengecek apakah papan penuh
  export function isBoardFull(board) {
    return board.flat().every(cell => cell === "X" || cell === "O");
  }
  
  // Fungsi untuk memulai permainan Tic Tac Toe
  export function startGame(chat, players) {
    const board = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
    ];
  
    return {
      board,
      players,
      turn: players[0], // Giliran pertama adalah pemain pertama
    };
  }
  
  // Fungsi untuk menempatkan simbol di papan
  export function placeSymbol(game, position, symbol) {
    const row = Math.floor((position - 1) / 3);
    const col = (position - 1) % 3;
  
    if (game.board[row][col] === "X" || game.board[row][col] === "O") {
      return { success: false, message: "Posisi ini sudah diisi. Pilih posisi lain." };
    }
  
    game.board[row][col] = symbol;
    return { success: true };
  }