import { useCallback, useEffect, useRef, useState } from 'react';
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps";
import '../echo';
import axios from 'axios';
import { Head, router } from '@inertiajs/react';
import InlineScoreBoard from '@/Components/InlineScoreBoard';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

export default function Playground({ user, game, isNew }) {
    const peerConnection = useRef(new Peer(undefined, {
        host: '/',
        port: 3003
    }));
    const matrix = useRef(Array(3).fill(null).map(() => Array(3).fill(null)));
    const canvasRef = useRef(null);
    const canvasContext = useRef(null);
    const isTurn = useRef(true);
    const thisPlayer = useRef(Math.random() > 0.5 ? true : false);
    const moveCount = useRef(0);
    const [playerOneScore, setPlayerOneScore] = useState(0);
    const [playerTwoScore, setPlayerTwoScore] = useState(0);
    const [playerTwo, setPlayerTwo] = useState(game.data.player_two);
    const mainConn = useRef(null);
    const playerOneLead = useRef(null);
    const playerTwoLead = useRef(null);
    const modal = useRef(null);
    const modalMessage = useRef(null);
    useEffect(() => {
        user.data.playerSide = thisPlayer.current;

        drawBoard();

        window.Echo.private(`game.${game.data.id}`)
            .listen('InitiateGame', (e) => {
                if (e.player.isPlayerTwo == true && user.data.id != e.player.id) {
                    setPlayerTwo(e.player);
                    game.data.player_two = e.player;
                } else {
                    setPlayerTwo(user.data);
                }
                thisPlayer.current = !e.player.playerSide;
                mainConn.current = peerConnection.current.connect(e.peerId);
        
                if (mainConn.current) {
                    isTurn.current = thisPlayer.current;
                    mainConn.current.on('data', (data) => {
                        try {
                            data = JSON.parse(data);
                            if (!thisPlayer.current) {
                                drawCross(data.a, data.b);
                            } else {
                                drawCircle(data.a, data.b);
                            }
                            isTurn.current = true;
                            whoseTurn();
                        } catch (error) {
                            console.error('Error handling data:', error);
                        }
                    });
    
                    canvasRef.current.addEventListener('click', (event) => {
                        if (!mainConn) {
                            console.error('No active connection');
                            return;
                        }
                    
                        var rect = canvasRef.current.getBoundingClientRect();
                        var x = Math.floor((event.clientX - rect.left) / 100);
                        var y = Math.floor((event.clientY - rect.top) / 100);
                    
                        if (isTurn.current) {
                            mainConn.current.send(JSON.stringify({
                                a : x,
                                b: y
                            }));
                        
                            if (thisPlayer.current) {
                                drawCross(x, y);
                            } else {
                                drawCircle(x, y);
                            }
                            isTurn.current = false;
                        }
                        whoseTurn();
                    });
                    
                    mainConn.current.on('error', (err) => {
                        console.error('Connection error:', err);
                    });
                    
                    mainConn.current.on('close', () => {
                        console.log('Connection closed');
                        mainConn.current = null;
                    });
                    
                    whoseTurn();
                }else{
                    console.log('error');
                }
            })
            .listen('EndGame', (e) => {
                showModal('The End.');
                setTimeout(() => {
                    router.get(route('dashboard'));
                }, 700);
            });
        peerConnection.current.on('open', (id) => {
            var isSecond = false;
            if(game.data.player_two){
                isSecond = game.data.player_two.id == user.data.id;
            }
            user.data.isPlayerTwo = isSecond;
            if (!isNew) {
                window.axios.post('/start', {
                    gameId: game.data.id,
                    peerId: id,
                    player: user.data,
                }).then((e) => {
                    return;
                }).catch((err) => {
                    throw new Error(err);
                });
            }
        });

        peerConnection.current.on('connection', (conn) => {
            if (mainConn.current = conn) {
                isTurn.current = thisPlayer.current;
                mainConn.current.on('data', (data) => {
                    try {
                        data = JSON.parse(data);
                        if (!thisPlayer.current) {
                            drawCross(data.a, data.b);
                        } else {
                            drawCircle(data.a, data.b);
                        }
                        isTurn.current = true;
                        whoseTurn();
                    } catch (error) {
                        console.error('Error handling data:', error);
                    }
                });

                canvasRef.current.addEventListener('click', (event) => {
                    if (!mainConn) {
                        console.error('No active connection');
                        return;
                    }
                
                    var rect = canvasRef.current.getBoundingClientRect();
                    var x = Math.floor((event.clientX - rect.left) / 100);
                    var y = Math.floor((event.clientY - rect.top) / 100);
                
                    if (isTurn.current) {
                        mainConn.current.send(JSON.stringify({
                            a : x,
                            b: y
                        }));
                    
                        if (thisPlayer.current) {
                            drawCross(x, y);
                        } else {
                            drawCircle(x, y);
                        }
                        isTurn.current = false;
                    }
                    whoseTurn();
                });
                
                mainConn.current.on('error', (err) => {
                    console.error('Connection error:', err);
                });
                
                mainConn.current.on('close', () => {
                    console.log('Connection closed');
                    mainConn.current = null;
                });
                
                whoseTurn();
            }else{
                console.log('error');
            }
        });

        document.getElementById('close-modal').addEventListener('click', closeModal);
    }, []);

    const endGame = () => {
        peerConnection.current.destroy();
        window.axios.post('/stop', {
            gameId: game.data.id,
            player: user.data,
        }).then((e) => {
            router.get(route('dashboard'));
            return;
        }).catch((err) => {
            throw new Error(err);
        });
    };

    const drawBoard = () => {
        canvasContext.current = canvasRef.current.getContext('2d');
        canvasContext.current.clearRect(0, 0, 310, 310);
        const verticies = [
                [[5, 5],   [300, 5]],
                [[5, 100], [300, 100]],
                [[5, 200], [300, 200]],
                [[5, 300], [300, 300]],
            ];

        verticies.forEach(vertice => {
                canvasContext.current.beginPath();
                canvasContext.current.moveTo(vertice[0][0], vertice[0][1]);
                canvasContext.current.lineTo(vertice[1][0], vertice[1][1]);
                canvasContext.current.stroke();

                canvasContext.current.beginPath();
                canvasContext.current.moveTo(vertice[0][1], vertice[0][0]);
                canvasContext.current.lineTo(vertice[1][1], vertice[1][0]);
                canvasContext.current.stroke();
        });
    }

    const whoseTurn = () => {
        if (user.data.id == game.data.player_one.id) {
            isTurn.current ? playerOneLead.current.classList.add('border-2', 'border-gray-400', 'shadow-xl') : playerOneLead.current.classList.remove('border-2', 'border-gray-400', 'shadow-xl');
            !isTurn.current ? playerTwoLead.current.classList.add('border-2', 'border-gray-400', 'shadow-xl') : playerTwoLead.current.classList.remove('border-2', 'border-gray-400', 'shadow-xl');
        }
        if (user.data.id == game.data.player_two.id) {
            !isTurn.current ? playerOneLead.current.classList.add('border-2', 'border-gray-400', 'shadow-xl') : playerOneLead.current.classList.remove('border-2', 'border-gray-400', 'shadow-xl');
            isTurn.current ? playerTwoLead.current.classList.add('border-2', 'border-gray-400', 'shadow-xl') : playerTwoLead.current.classList.remove('border-2', 'border-gray-400', 'shadow-xl');
        }
    };

    const drawCross = (xPos, yPos) => {
        if (matrix.current[xPos][yPos] != null) {
            return;
        }

        var crossVertices = [];
        var baseX = xPos * 100 + 15;
        var baseY = yPos * 100 + 15;
        
        crossVertices = [
            [[baseX, baseY], [baseX + 75, baseY + 75]],
            [[baseX + 75, baseY], [baseX, baseY + 75]] 
        ];
        

        crossVertices.forEach(cross => {
            canvasContext.current.beginPath();
            canvasContext.current.moveTo(cross[0][0], cross[0][1]);
            canvasContext.current.lineTo(cross[1][0], cross[1][1]);
            canvasContext.current.stroke();
        });
        matrix.current[xPos][yPos] = 1;
        setTimeout(() => {
            checkWin(1);
        }, 10);
    };

    const drawCircle = (xPos, yPos) => {
        if (matrix.current[xPos][yPos] != null) {
            return;
        }
        const baseX = (xPos * 100) + 52.5;
        const baseY = (yPos * 100) + 52.5;
        canvasContext.current.beginPath();
        canvasContext.current.arc(baseX, baseY, 30, 0, 2 * Math.PI);
        canvasContext.current.stroke();
        matrix.current[xPos][yPos] = 0;
        setTimeout(() => {
            checkWin(0);
        }, 10)
    };

    const checkWin = (player) => {
        const size = 3;
        let win = false;
    
        let rowWin, colWin;
        let diag1Win = true;
        let diag2Win = true;
    
        for (let i = 0; i < size; i++) {
            rowWin = true;
            colWin = true;
    
            for (let j = 0; j < size; j++) {
                
                if (matrix.current[i][j] !== player) {
                    rowWin = false;
                }
                
                if (matrix.current[j][i] !== player) {
                    colWin = false;
                }
            }
            
            if (rowWin || colWin) {
                win = true;
                break;
            }
            
            if (matrix.current[i][i] !== player) {
                diag1Win = false;
            }
            if (matrix.current[i][size - i - 1] !== player) {
                diag2Win = false;
            }
        }
        
        if (diag1Win || diag2Win) {
            win = true;
        }
        
        moveCount.current++;
    
        if (win) {
            if (player == 1 && thisPlayer.current == true) {
                if (user.data.id == game.data.player_one.id) {
                    setPlayerOneScore(prev => prev + 1);
                }else{
                    setPlayerTwoScore(prev => prev + 1);
                }
                window.axios.post('/score', {
                    score: 1
                }).then((e) => {
                    return;
                }).catch((err) => {
                    console.error(err);
                });
                showModal('You won :)');
            }else if(player == 1 && thisPlayer.current == false){
                if (user.data.id == game.data.player_two.id) {
                    setPlayerOneScore(prev => prev + 1);
                }else{
                    setPlayerTwoScore(prev => prev + 1);
                }
                showModal('Player X won :(');
            }else if(player == 0 && thisPlayer.current == true){
                if (user.data.id == game.data.player_two.id) {
                    setPlayerOneScore(prev => prev + 1);
                }else{
                    setPlayerTwoScore(prev => prev + 1);
                }
                showModal('Player: O won :(')
            }else if(player == 0 && thisPlayer.current == false){
                if (user.data.id == game.data.player_one.id) {
                    setPlayerOneScore(prev => prev + 1);
                }else{
                    setPlayerTwoScore(prev => prev + 1);
                }
                window.axios.post('/score', {
                    score: 1
                }).then((e) => {
                    return;
                }).catch((err) => {
                    console.error(err);
                });
                showModal('You won :)')
            }
            matrix.current = Array(3).fill(null).map(() => Array(3).fill(null));
            moveCount.current = 0;
            setTimeout(() => {
                drawBoard();
            }, 200);
            return;
        }
        if (moveCount.current == 9){
            matrix.current = Array(3).fill(null).map(() => Array(3).fill(null));
            moveCount.current = 0;
            setTimeout(() => {
                drawBoard();
            }, 200);
            showModal('It is a Draw :|');
            return;
        }
    };
    const showModal = (message) => {
        modalMessage.current.textContent = message;
        modal.current.classList.remove('hidden');
        modal.current.classList.add('flex');
    }
    
    const closeModal = () => {
        modal.current.classList.add('hidden');
        modal.current.classList.remove('flex'); 
    }
    return(
        <div className='w-screen h-screen bg-gray-300 pt-4'>
            <Head title='Tic Tac Toe'/>
            <div className='mx-auto w-[358px] h-[406px] shadow-2xl rounded-2xl p-6 bg-gray-100'>
                <h1 className='w-full text-center font-bold text-2xl mb-4'>Tic Tac Toe</h1>
                <canvas width={310} height={310} ref={canvasRef}></canvas>
            </div>
            <div className='mx-auto w-[358px] h-16 overflow-hidden flex flex-row justify-between py-4'>
                <div ref={playerOneLead} className='overflow-y-scroll bg-gray-100 h-full w-fit flex justify-center items-center px-4 rounded'>
                    <span className='block font-bold'>Player One: {isNew ? user.data.name : game.data.player_one.name}</span>
                    <span>|
                      {user.data.id === game.data.player_one.id 
                        ? (thisPlayer.current ? 'X' : 'O') 
                        : (thisPlayer.current ? 'O' : 'X')}
                    </span>
                </div>
                <div ref={playerTwoLead} className='overflow-y-scroll bg-gray-100 h-full w-fit flex justify-center items-center px-4 rounded'>
                    <span className='block font-bold'>Player Two: {playerTwo == null ? 'loading' : playerTwo.name}</span>
                    <span>|
                      {user.data.id !== game.data.player_one.id 
                        ? (thisPlayer.current ? 'X' : 'O') 
                        : (thisPlayer.current ? 'O' : 'X')}
                    </span>
                </div>
            </div>
            <InlineScoreBoard playerOneScore={playerOneScore} playerTwoScore={playerTwoScore} />
            <div className='w-[358px] mx-auto mt-4 flex justify-end items-end'>
                <button onClick={() => endGame()} className='bg-red-500 rounded text-white py-2 px-4'>End Game</button>
            </div>
            <div ref={modal} className="fixed inset-0 items-center justify-center bg-gray-900 bg-opacity-50 hidden">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full relative">
                    <h2 ref={modalMessage} className="text-xl font-semibold mb-4">Custom Alert</h2>
                    <button id="close-modal" className="absolute right-2 bottom-2 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600">
                        OK
                    </button>
                </div>
            </div>
        </div>
    )
};