/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as chai from 'chai';
import { MultiRingBuffer } from './multi-ring-buffer';

const expect = chai.expect;

describe('MultiRingBuffer', function (): void {

    it('expect buffer to be empty initialized', function (): void {
        const size = 2;
        const compareTo = Buffer.from('0000', 'hex');
        const ringBuffer = new MultiRingBuffer({ size });
        // eslint-disable-next-line no-unused-expressions
        expect(ringBuffer['buffer'].equals(compareTo)).to.be.true;
    });

    it('expect enq and deq a string with unicode characters > 1 byte and no wrap around', function (): void {
        const ringBufferSize = 15;
        const ringBuffer = new MultiRingBuffer({ size: ringBufferSize });
        const buffer = '\u00bd + \u00bc = \u00be';
        const bufferByteLength = Buffer.byteLength(buffer, 'utf8');

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(bufferByteLength);
    });

    it('expect enq and deq a string with unicode characters > 1 byte and wrap around', function (): void {
        const buffer = '\u00bd + \u00bc = \u00be';
        const ringBufferSize = Buffer.byteLength(buffer[buffer.length - 1]);
        const ringBuffer = new MultiRingBuffer({ size: ringBufferSize });

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(ringBufferSize);

        const reader = ringBuffer.getReader();
        const readBuffer = ringBuffer.deq(reader);

        expect(ringBuffer).to.not.be.equal(undefined);
        if (readBuffer !== undefined) {
            expect(readBuffer).to.be.equal(buffer[buffer.length - 1].toString());
        }
    });

    it('expect enq a string < ring buffer size ', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffer = 'test';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(buffer.length);
        expect(ringBuffer.empty()).to.be.equal(false);
        const reader = ringBuffer.getReader();
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(buffer.length);
        expect(ringBuffer.emptyForReader(reader)).to.be.equal(false);

    });

    it('expect deq a string < ring buffer size ', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        const buffer = 'test';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(4);
        const reader = ringBuffer.getReader();
        const readBuffer = ringBuffer.deq(reader);
        expect(ringBuffer.size()).to.be.equal(4);
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
        expect(readBuffer).to.equal(buffer);

    });

    it('expect deq a string > ring buffer size ', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffer = 'testabcd';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(size);
        const reader = ringBuffer.getReader();
        const readBuffer = ringBuffer.deq(reader);
        expect(ringBuffer.size()).to.be.equal(size);
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
        expect(readBuffer).to.equal(buffer.substr(buffer.length - size));

    });

    it('expect enq deq enq deq a string > ring buffer size ', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffer = '12345678';

        for (let i = 0; i < 2; i++) {
            ringBuffer.enq(buffer);
            expect(ringBuffer.size()).to.be.equal(size);

            const reader = ringBuffer.getReader();
            const readBuffer = ringBuffer.deq(reader);

            expect(ringBuffer.size()).to.be.equal(size);
            expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
            expect(readBuffer).to.equal(buffer.substr(buffer.length - size));
        }
    });

    it('expect enq a string == ring buffer size then one > ring buffer size and dequeue them ', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['12345', '12345678'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
            expect(ringBuffer.size()).to.be.equal(size);
        }
        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal(buffers[buffers.length - 1].substr(buffers[buffers.length - 1].length - size));
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect enq a string == ring buffer size then one < ring buffer size and dequeue them ', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['12345', '123'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
            expect(ringBuffer.size()).to.be.equal(size);
        }
        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal('45123');
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect enq a string == ring buffer size then one < ring buffer  then one < buffer size and dequeue ', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['12345', '123', '678'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
            expect(ringBuffer.size()).to.be.equal(size);
        }
        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal('23678');
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect enq buffer size then enq 1 to dequeue the right value', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['12345', '1'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
            expect(ringBuffer.size()).to.be.equal(size);
        }
        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal('23451');
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect enq buffer size then enq 1 twice to dequeue the right value', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['12345', '1', '12345', '1'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
            expect(ringBuffer.size()).to.be.equal(size);
        }
        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal('23451');
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect enq buffer size of various sizes dequeue the right value', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['12345', '123', '678', '12345', '1', '12345', '123', '12', '12', '1', '12', '123', '1234', '12345', '1', '12'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
            expect(ringBuffer.size()).to.be.equal(size);
        }

        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal('45112');
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect enq buffer sizes < buffer size to dequeue normally', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['1', '1'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
        }
        expect(ringBuffer.size()).to.be.equal(2);
        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal('11');
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect enq buffer size of various sizes dequeue the right value', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffers = ['1', '1', '12', '12'];

        for (const buffer of buffers) {
            ringBuffer.enq(buffer);
        }
        expect(ringBuffer.size()).to.be.equal(size);
        const reader = ringBuffer.getReader();
        let i = 0;
        for (const _ of buffers) {
            const readBuffer = ringBuffer.deq(reader);
            if (i === 0) {
                expect(readBuffer).to.equal('11212');
            } else {
                expect(readBuffer).to.equal(undefined);
            }
            i++;
        }
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect multiple enq and deq to deq the right values', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        ringBuffer.enq('12345');

        expect(ringBuffer.size()).to.be.equal(size);
        const reader = ringBuffer.getReader();
        let readBuffer = ringBuffer.deq(reader);
        expect(readBuffer).to.equal('12345');

        ringBuffer.enq('123');
        readBuffer = ringBuffer.deq(reader);
        expect(readBuffer).to.equal('123');

        ringBuffer.enq('12345');
        readBuffer = ringBuffer.deq(reader);
        expect(readBuffer).to.equal('12345');

        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
    });

    it('expect data from stream on enq', async function (): Promise<void> {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffer = 'abc';

        const astream = ringBuffer.getStream();
        const p = new Promise<void>(resolve => {
            astream.on('data', (chunk: string) => {
                expect(chunk).to.be.equal(buffer);
                resolve();
            });
        });
        ringBuffer.enq(buffer);

        await p;
    });

    it('expect data from stream when data is already ended', async function (): Promise<void> {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffer = 'abc';
        ringBuffer.enq(buffer);

        const astream = ringBuffer.getStream();
        const p = new Promise<void>(resolve => {
            astream.on('data', (chunk: string) => {
                expect(chunk).to.be.equal(buffer);
                resolve();
            });
        });

        await p;
    });

    it('expect disposing of a stream to delete it from the ringbuffer', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const astream = ringBuffer.getStream();
        astream.dispose();
        expect(ringBuffer.streamsSize()).to.be.equal(0);
        expect(ringBuffer.readersSize()).to.be.equal(0);
    });

    it('expect disposing of a reader to delete it from the ringbuffer', function (): void {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const reader = ringBuffer.getReader();
        ringBuffer.closeReader(reader);
        expect(ringBuffer.readersSize()).to.be.equal(0);
    });

    it('expect enq a string in utf8 and get it in hex', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        const buffer = 'test';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(4);
        const reader = ringBuffer.getReader();
        const readBuffer = ringBuffer.deq(reader, -1, 'hex');
        expect(readBuffer).to.equal('74657374');
    });

    it('expect enq a string in hex and get it in utf8', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        const buffer = '74657374';

        ringBuffer.enq(buffer, 'hex');
        expect(ringBuffer.size()).to.be.equal(4);
        const reader = ringBuffer.getReader();
        const readBuffer = ringBuffer.deq(reader);
        expect(readBuffer).to.equal('test');
    });

    it('expect data from stream in hex when enq in uf8', async function (): Promise<void> {
        const size = 5;
        const ringBuffer = new MultiRingBuffer({ size });
        const buffer = 'test';
        ringBuffer.enq(buffer);

        const astream = ringBuffer.getStream('hex');
        const p = new Promise<void>(resolve => {
            astream.on('data', (chunk: string) => {
                expect(chunk).to.be.equal('74657374');
                resolve();
            });
        });

        await p;
    });

    it('expect deq a string < ring buffer size with the internal encoding in hex ', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5, encoding: 'hex' });
        const buffer = 'test';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(4);
        const reader = ringBuffer.getReader();
        const readBuffer = ringBuffer.deq(reader);
        expect(ringBuffer.size()).to.be.equal(4);
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
        expect(readBuffer).to.equal(buffer);

    });

    it('expect the ringbuffer to be empty if we enq an empty string', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        const buffer = '';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(0);
        expect(ringBuffer.empty()).to.be.equal(true);
    });

    it('expect an invalid reader count to be zero', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        expect(ringBuffer.sizeForReader(1)).to.be.equal(0);
    });

    it('expect an invalid reader to be empty', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        expect(ringBuffer.emptyForReader(1)).to.be.equal(true);
    });

    it('expect partially deq a string < ring buffer size ', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        const buffer = 'test';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(4);
        const reader = ringBuffer.getReader();
        let readBuffer = ringBuffer.deq(reader, 2);
        expect(ringBuffer.size()).to.be.equal(4);
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(2);
        expect(readBuffer).to.equal('te');

        readBuffer = ringBuffer.deq(reader, 2);
        expect(ringBuffer.size()).to.be.equal(4);
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(0);
        expect(readBuffer).to.equal('st');
    });

    it('expect partially deq a string < ring buffer size then enq and deq again ', function (): void {
        const ringBuffer = new MultiRingBuffer({ size: 5 });
        const buffer = 'test';
        const secondBuffer = 'abcd';

        ringBuffer.enq(buffer);
        expect(ringBuffer.size()).to.be.equal(4);
        const reader = ringBuffer.getReader();
        let readBuffer = ringBuffer.deq(reader, 2);
        expect(ringBuffer.size()).to.be.equal(4);
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(2);
        expect(readBuffer).to.equal('te');

        ringBuffer.enq(secondBuffer);
        readBuffer = ringBuffer.deq(reader, 4);
        expect(ringBuffer.size()).to.be.equal(5);
        expect(readBuffer).to.equal('tabc');
        expect(ringBuffer.sizeForReader(reader)).to.be.equal(1);

    });
});
