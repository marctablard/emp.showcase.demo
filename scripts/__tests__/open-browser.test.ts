import { execFile, spawn } from 'child_process';
import { openBrowser } from '../open-browser';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
  spawn: jest.fn()
}));

const mockExecFile = execFile as jest.Mock;
const mockSpawn = spawn as jest.Mock;

describe('openBrowser', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    mockExecFile.mockClear();
    
    mockSpawn.mockClear();
    mockSpawn.mockReturnValue({
      on: jest.fn().mockReturnThis(),
      unref: jest.fn()
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  const setPlatform = (platform: string) => {
    Object.defineProperty(process, 'platform', {
      value: platform
    });
  };

  it('should use open on darwin', () => {
    setPlatform('darwin');
    openBrowser('http://localhost:3000');
    expect(mockExecFile).toHaveBeenCalledWith('/usr/bin/open', ['http://localhost:3000'], expect.any(Function));
  });

  it('should use cmd start on win32', () => {
    setPlatform('win32');
    
    let childOnMock = jest.fn().mockReturnThis();
    mockSpawn.mockReturnValue({
      on: childOnMock,
      unref: jest.fn()
    });

    openBrowser('http://localhost:3000');
    const expectedCmdPath = process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`;
    expect(mockSpawn).toHaveBeenCalledWith(expectedCmdPath, ['/c', 'start', '""', 'http://localhost:3000'], {
      windowsVerbatimArguments: true,
      detached: true
    });
    
    expect(childOnMock).toHaveBeenCalledWith('error', expect.any(Function));
    expect(childOnMock).toHaveBeenCalledWith('spawn', expect.any(Function));
  });

  it('should use xdg-open on linux and others', () => {
    setPlatform('linux');
    openBrowser('http://localhost:3000');
    expect(mockExecFile).toHaveBeenCalledWith('/usr/bin/xdg-open', ['http://localhost:3000'], expect.any(Function));
  });
});
