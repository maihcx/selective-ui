export const mockEffector = () => ({
    setElement: jest.fn(),
    expand: jest.fn(({ onComplete }) => onComplete && onComplete()),
    collapse: jest.fn(({ onComplete }) => onComplete && onComplete()),
    resize: jest.fn(),
    getHiddenDimensions: jest.fn(() => ({
        scrollHeight: 300
    }))
});