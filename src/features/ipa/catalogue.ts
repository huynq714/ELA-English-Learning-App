export type IpaExample = { word: string; ipa: string };
export type IpaSound = {
  id: string;
  symbol: string;
  kind: 'monophthong' | 'diphthong' | 'consonant';
  guidance: string;
  examples: readonly IpaExample[];
};

type Entry = [id: string, symbol: string, guidance: string, word: string, ipa: string, second: string, secondIpa: string];

function catalogue(kind: IpaSound['kind'], entries: Entry[]): IpaSound[] {
  return entries.map(([id, symbol, guidance, word, ipa, second, secondIpa]) => ({
    id, symbol, kind, guidance, examples: [{ word, ipa }, { word: second, ipa: secondIpa }],
  }));
}

// Traditional British English teaching inventory. /ʊə/ also has modern UK variants.
export const ipaSounds = [
  ...catalogue('monophthong', [
    ['fleece', 'iː', 'Nâng phần trước lưỡi lên cao, môi hơi bè. Giữ nguyên âm dài.', 'sheep', 'ʃiːp', 'green', 'ɡriːn'],
    ['kit', 'ɪ', 'Nâng phần trước lưỡi vừa phải, thả lỏng môi. Phát âm ngắn.', 'ship', 'ʃɪp', 'fish', 'fɪʃ'],
    ['foot', 'ʊ', 'Nâng phần sau lưỡi và hơi tròn môi. Phát âm ngắn.', 'good', 'ɡʊd', 'book', 'bʊk'],
    ['goose', 'uː', 'Nâng lưỡi lên cao, tròn môi nhẹ và giữ âm dài.', 'moon', 'muːn', 'food', 'fuːd'],
    ['dress', 'e', 'Đưa phần trước lưỡi lên giữa miệng, môi thả lỏng. Phát âm ngắn.', 'bed', 'bed', 'pen', 'pen'],
    ['schwa', 'ə', 'Thả lỏng hàm, môi và lưỡi. Đọc rất nhẹ ở âm tiết không nhấn.', 'about', 'əˈbaʊt', 'banana', 'bəˈnɑːnə'],
    ['nurse', 'ɜː', 'Giữ lưỡi ở giữa miệng, môi thả lỏng. Giữ âm dài; đừng thêm /r/ cuối từ.', 'bird', 'bɜːd', 'word', 'wɜːd'],
    ['thought', 'ɔː', 'Kéo lưỡi về sau, tròn môi và giữ âm dài.', 'saw', 'sɔː', 'law', 'lɔː'],
    ['trap', 'æ', 'Hạ hàm và đưa phần trước lưỡi xuống thấp. Môi hơi bè.', 'cat', 'kæt', 'mat', 'mæt'],
    ['strut', 'ʌ', 'Mở miệng vừa, giữ lưỡi thấp gần giữa miệng. Môi không tròn.', 'cup', 'kʌp', 'cut', 'kʌt'],
    ['palm', 'ɑː', 'Hạ hàm, lưỡi thấp về sau, môi không tròn. Giữ âm dài.', 'car', 'kɑː', 'start', 'stɑːt'],
    ['lot', 'ɒ', 'Mở hàm, lưỡi thấp về sau và hơi tròn môi. Phát âm ngắn.', 'hot', 'hɒt', 'not', 'nɒt'],
  ]),
  ...catalogue('diphthong', [
    ['face', 'eɪ', 'Bắt đầu ở /e/, nâng lưỡi nhẹ về /ɪ/ trong cùng một âm tiết.', 'day', 'deɪ', 'train', 'treɪn'],
    ['price', 'aɪ', 'Mở hàm khi bắt đầu rồi nâng phần trước lưỡi về /ɪ/.', 'time', 'taɪm', 'fine', 'faɪn'],
    ['choice', 'ɔɪ', 'Bắt đầu với môi tròn rồi thả môi và lướt về /ɪ/.', 'boy', 'bɔɪ', 'coin', 'kɔɪn'],
    ['goat', 'əʊ', 'Bắt đầu với lưỡi ở giữa rồi nâng lưỡi và hơi tròn môi.', 'go', 'ɡəʊ', 'coat', 'kəʊt'],
    ['mouth', 'aʊ', 'Bắt đầu với hàm mở rồi khép hàm nhẹ và tròn môi về /ʊ/.', 'now', 'naʊ', 'house', 'haʊs'],
    ['near', 'ɪə', 'Bắt đầu ở /ɪ/ rồi thả lưỡi về giữa miệng. Không thêm /r/ cuối từ.', 'ear', 'ɪə', 'near', 'nɪə'],
    ['square', 'eə', 'Bắt đầu ở /e/ rồi thả lỏng về /ə/ theo cách đọc truyền thống.', 'hair', 'heə', 'there', 'ðeə'],
    ['cure', 'ʊə', 'Bắt đầu ở /ʊ/ rồi thả tròn môi về /ə/. Một số giọng Anh hiện đại dùng âm khác.', 'tourist', 'ˈtʊərɪst', 'cure', 'kjʊə'],
  ]),
  ...catalogue('consonant', [
    ['p', 'p', 'Khép hai môi rồi bật hơi. Dây thanh không rung.', 'pen', 'pen', 'cap', 'kæp'],
    ['b', 'b', 'Khép hai môi rồi bật mở. Đây là âm hữu thanh.', 'ball', 'bɔːl', 'cab', 'kæb'],
    ['t', 't', 'Chạm đầu lưỡi vào lợi trên rồi nhả hơi. Không rung dây thanh.', 'tea', 'tiː', 'cat', 'kæt'],
    ['d', 'd', 'Chạm đầu lưỡi vào lợi trên rồi nhả. Đây là âm hữu thanh.', 'day', 'deɪ', 'bed', 'bed'],
    ['k', 'k', 'Chặn hơi bằng phần sau lưỡi ở ngạc mềm rồi nhả, không rung dây thanh.', 'key', 'kiː', 'back', 'bæk'],
    ['g', 'ɡ', 'Chặn hơi bằng phần sau lưỡi ở ngạc mềm rồi nhả. Đây là âm hữu thanh.', 'go', 'ɡəʊ', 'bag', 'bæɡ'],
    ['ch', 'tʃ', 'Chặn hơi sau lợi rồi nhả thành tiếng xát, không rung dây thanh.', 'chair', 'tʃeə', 'watch', 'wɒtʃ'],
    ['j-affricate', 'dʒ', 'Chặn hơi sau lợi rồi nhả thành tiếng xát hữu thanh.', 'jam', 'dʒæm', 'edge', 'edʒ'],
    ['f', 'f', 'Đặt răng trên lên môi dưới, thổi hơi, không rung dây thanh.', 'fish', 'fɪʃ', 'leaf', 'liːf'],
    ['v', 'v', 'Đặt răng trên lên môi dưới, cho hơi đi qua và rung dây thanh.', 'van', 'væn', 'leave', 'liːv'],
    ['th', 'θ', 'Đặt đầu lưỡi nhẹ giữa hai hàm răng rồi thổi hơi. Không rung dây thanh.', 'thin', 'θɪn', 'teeth', 'tiːθ'],
    ['dh', 'ð', 'Đặt đầu lưỡi nhẹ giữa hai hàm răng. Cho hơi thoát và rung dây thanh.', 'this', 'ðɪs', 'mother', 'ˈmʌðə'],
    ['s', 's', 'Đưa đầu lưỡi sát lợi trên và thổi qua khe hẹp. Không rung dây thanh.', 'see', 'siː', 'bus', 'bʌs'],
    ['z', 'z', 'Đưa đầu lưỡi sát lợi trên, cho hơi đi qua khe hẹp và rung dây thanh.', 'zoo', 'zuː', 'nose', 'nəʊz'],
    ['sh', 'ʃ', 'Nâng lưỡi gần vùng sau lợi trên và hơi tròn môi. Không rung dây thanh.', 'ship', 'ʃɪp', 'wash', 'wɒʃ'],
    ['zh', 'ʒ', 'Nâng lưỡi gần vùng sau lợi trên. Đẩy hơi nhẹ và rung dây thanh.', 'vision', 'ˈvɪʒən', 'treasure', 'ˈtreʒə'],
    ['m', 'm', 'Khép hai môi, rung dây thanh và cho hơi thoát qua mũi.', 'moon', 'muːn', 'time', 'taɪm'],
    ['n', 'n', 'Chạm đầu lưỡi vào lợi trên; cho hơi thoát qua mũi.', 'no', 'nəʊ', 'pen', 'pen'],
    ['ng', 'ŋ', 'Nâng phần sau lưỡi lên ngạc mềm, cho hơi qua mũi. Không thêm /ɡ/ ở cuối.', 'sing', 'sɪŋ', 'ring', 'rɪŋ'],
    ['h', 'h', 'Thở nhẹ qua thanh môn, miệng chuẩn bị cho nguyên âm tiếp theo.', 'hat', 'hæt', 'house', 'haʊs'],
    ['l', 'l', 'Chạm đầu lưỡi vào lợi trên và để hơi thoát hai bên lưỡi.', 'light', 'laɪt', 'feel', 'fiːl'],
    ['r', 'r', 'Đưa đầu lưỡi gần vùng sau lợi trên, không chạm và không rung đầu lưỡi.', 'right', 'raɪt', 'rain', 'reɪn'],
    ['w', 'w', 'Tròn môi, nâng phần sau lưỡi rồi lướt nhanh vào nguyên âm.', 'win', 'wɪn', 'wet', 'wet'],
    ['y', 'j', 'Nâng mặt lưỡi về phía ngạc cứng rồi lướt ngay vào nguyên âm.', 'yes', 'jes', 'you', 'juː'],
  ]),
] as const;

export const findIpaSound = (id: string | undefined) => ipaSounds.find(sound => sound.id === id);

export const soundsRightUrl = 'https://learnenglish.britishcouncil.org/apps/learnenglish-sounds-right';
export const dictionaryUrl = (word: string) => 'https://dictionary.cambridge.org/pronunciation/english/' + encodeURIComponent(word);
