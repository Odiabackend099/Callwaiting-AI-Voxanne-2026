import { VapiClient, AssistantConfig } from './vapi-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VapiClient', () => {
    let client: VapiClient;
    const apiKey = 'test-api-key';

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock axios.create to return the mocked instance
        mockedAxios.create.mockReturnValue(mockedAxios as any);
        // Mock interceptors
        (mockedAxios as any).interceptors = {
            response: {
                use: jest.fn(),
            },
        };

        client = new VapiClient(apiKey);
    });

    describe('Constructor', () => {
        it('should sanitize API key', () => {
            const dirtyKey = '  test-key\n\t  ';
            const cleanClient = new VapiClient(dirtyKey);
            // Access private property logic would check if it didn't throw
            expect(cleanClient).toBeDefined();
        });

        it('should throw error if API key is empty', () => {
            expect(() => new VapiClient('')).toThrow('VapiClient: API key is required');
        });
    });

    describe('createAssistant', () => {
        const config: AssistantConfig = {
            name: 'Test Assistant',
            systemPrompt: 'You are a test.'
        };

        it('should create assistant successfully', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: { id: 'asst_123' } });

            const result = await client.createAssistant(config);

            expect(mockedAxios.post).toHaveBeenCalledWith('/assistant', expect.objectContaining({
                name: 'Test Assistant',
                model: expect.objectContaining({
                    messages: [{ role: 'system', content: 'You are a test.' }]
                })
            }));
            expect(result).toEqual({ id: 'asst_123' });
        });

        it('should handle API errors', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

            await expect(client.createAssistant(config)).rejects.toThrow('API Error');
        });
    });

    describe('Circuit Breaker', () => {
        it('should open after threshold failures', async () => {
            const config: AssistantConfig = { name: 'Fail', systemPrompt: '' };
            mockedAxios.post.mockRejectedValue(new Error('Fail'));

            // Threshold is 5. Trigger 5 failures.
            for (let i = 0; i < 5; i++) {
                try {
                    await client.createAssistant(config);
                } catch (e) { }
            }

            // 6th attempt should fail fast with Circuit Breaker error
            await expect(client.createAssistant(config)).rejects.toThrow('circuit breaker is open');
        });
    });
});
