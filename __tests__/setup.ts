// Jest 전역 설정
// NODE_ENV는 Jest가 자동으로 'test'로 설정함
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
process.env.NEXTAUTH_SECRET = 'test-secret-32-characters-minimum!!';
process.env.JWT_SECRET = 'test-jwt-secret-32-characters-minimum!!';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.WEB_APP_URL = 'http://localhost:3000';
process.env.AI_ENGINE_URL = 'http://localhost:8000';
process.env.AI_ENGINE_API_KEY = 'test-api-key-at-least-20-characters';
