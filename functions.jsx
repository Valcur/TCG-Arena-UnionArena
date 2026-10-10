async function onNewTurn() {
    // If my turn
    if (!game.turn.isMyTurn) {
        untapAll()
        return
    }

    const turnCount = game.turn.count
    if (turnCount % 2 === 1) {
        if (turnCount <= 5) {
            addAPPoint(1)
        }
    } else {
        if (turnCount === 2) {
            addAPPoint(2)
        } else if (turnCount === 6) {
            addAPPoint(1)
        }
    }
}

async function addAPPoint(count = 1) {
    const remainingAP = cards.APReserve?.length ?? 0
    if (remainingAP < count) return
    await functions.hideCards(cards.APReserve.slice(0, count), "no")
    await functions.moveCards(cards.APReserve.slice(0, count), "Mana")
    await functions.repositionCards()
}

async function untapAll() {
    const allCards = [
        ...(cards?.FrontLine ?? []),
        ...(cards?.EnergyLine ?? []),
    ];

    await functions.updateCards(allCards, { isTapped: false });
    await functions.repositionCards();
}