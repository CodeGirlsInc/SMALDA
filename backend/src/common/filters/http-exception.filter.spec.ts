import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
const mockGetRequest = jest.fn().mockReturnValue({ url: '/test' });
const mockSwitchToHttp = jest.fn().mockReturnValue({
  getResponse: mockGetResponse,
  getRequest: mockGetRequest,
});
const mockHost = { switchToHttp: mockSwitchToHttp } as any;

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new HttpExceptionFilter();
  });

  it('handles HttpException with correct status and message', () => {
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), mockHost);
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Not found' }));
  });

  it('handles non-HttpException with 500 status', () => {
    filter.catch(new Error('Unexpected'), mockHost);
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });

  it('includes stack trace in non-production mode', () => {
    filter = new HttpExceptionFilter(false);
    filter.catch(new Error('oops'), mockHost);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ stack: expect.any(String) }));
  });

  it('omits stack trace in production mode', () => {
    filter = new HttpExceptionFilter(true);
    filter.catch(new Error('oops'), mockHost);
    const payload = mockJson.mock.calls[0][0];
    expect(payload.stack).toBeUndefined();
  });
});
