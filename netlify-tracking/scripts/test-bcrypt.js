const bcrypt = require('bcryptjs');

async function testPassword() {
    const password = 'Test1234!';

    // 新しいハッシュを生成
    const newHash = await bcrypt.hash(password, 10);
    console.log('New hash for Test1234!:', newHash);

    // テスト: ハッシュと比較
    const testHash = '$2a$10$RmTDFgQzWjQ9KgUDTBw2PeDxXWcZ5TBqjKQWz8f1KmGvNqaQ9jBSy';
    const isValid = await bcrypt.compare(password, testHash);
    console.log('Test1234! is valid with stored hash:', isValid);

    // 各アカウントのパスワードをテスト
    const accounts = [
        {
            password: 'Kx9mP#2nQ@7z',
            hash: '$2a$10$JQ6eaccYf1mOTpK9eqC1COe6s6WFNO5514ZloDGSd4oLz5mh8z256'
        }
    ];

    for (const account of accounts) {
        const valid = await bcrypt.compare(account.password, account.hash);
        console.log(`Password "${account.password}" is valid:`, valid);

        if (!valid) {
            const correctHash = await bcrypt.hash(account.password, 10);
            console.log('Correct hash should be:', correctHash);
        }
    }
}

testPassword().catch(console.error);