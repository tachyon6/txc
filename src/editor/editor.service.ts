import { Injectable } from '@nestjs/common';
import * as ytdl from 'ytdl-core';
import * as fs from 'fs';
import { InputOfOneVideo, VideoInfos } from './editor.interface';
import * as ffmpeg from 'fluent-ffmpeg';



@Injectable()
export class EditorService {
    constructor() {}

    async processVideo(userInputs: InputOfOneVideo[], fileName: string): Promise<any> {
        try{
            //async download
            const downloadPromises = userInputs.map(async (input) => {
                const url= input.url;
                const info = await ytdl.getInfo(url);
                const videoTitle = info.videoDetails.title;
                const videoId = info.videoDetails.videoId;
                await this.downloadYTVideo(url, videoId);
                console.log(videoTitle, 'downloaded successfully');
            });
            //await all download
            await Promise.all(downloadPromises);

            const videoInfos: VideoInfos[] = [];
            //async cut
            const cutPromises = userInputs.map(async (input) => {
                const { url, startTime, endTime } = input;
                const info = await ytdl.getInfo(url);
                const videoTitle = info.videoDetails.title;
                const videoId = info.videoDetails.videoId;
                const startTimeInSecond = timeStampToSeconds(startTime);
                const endTimeInSecond = timeStampToSeconds(endTime);
                videoInfos.push({videoId: videoId, startTime: startTimeInSecond, endTime: endTimeInSecond});
                await this.cutVideo(videoId, startTimeInSecond, endTimeInSecond);
                console.log(videoTitle + ' video cut successfully');
            });

            //await all cut
            await Promise.all(cutPromises);

            const outputFileName = fileName;
            await this.mergeVideos(videoInfos, outputFileName);

            await this.deleteVideos(videoInfos, fileName);

            return 'success';
        } catch (err) {
            console.log('processVideo() error')
            throw err;
        }
    }


    async downloadYTVideo(url: string, videoId: string): Promise<any> {
        try{
            const videoStream = await ytdl(url);
            const outputStream = fs.createWriteStream(`./videos/${videoId}.mp4`);

            return new Promise<void>((resolve, reject) => {
                videoStream.pipe(outputStream);

                outputStream.on('finish', () => {
                    console.log('Video download completed');
                    resolve();
                });

                outputStream.on('error', (err) => {
                    console.log('downloadYTVideo() error', err);
                    reject(err);
                });
            });
        } catch (err) {
            console.log('downloadYTVideo() error')
            throw err;
        }
    }

    async cutVideo(videoId: string, startTime: number, endTime: number): Promise<any> {
        try{
            console.log('cutVideo() called');
            return new Promise<void>((resolve, reject) => {
                ffmpeg(`./videos/${videoId}.mp4`)
                    //set size to 640x360
                    .size('640x360')
                    .autopad()
                    //set fps to 30
                    .fps(30)
                    .setStartTime(startTime)
                    .setDuration(endTime - startTime)
                    .output(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4`)
                    .on('end', () => {
                        console.log(videoId + ' video cut completed');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.log('cutVideo() error', err);
                        reject(err);
                    })
                    .run();
            });
        } catch(err){
            throw err;
        }
    }

    async mergeVideos(videoInfos: VideoInfos[], fileName: string): Promise<any> {
        try{
            return new Promise<void>(async (resolve, reject) => {
                const mergedVideo = await ffmpeg();
                for (const info of videoInfos) {
                    mergedVideo.addInput(`./videos/${info.startTime}-${info.endTime}-${info.videoId}_cutted.mp4`);
                }
                const outputFileName = `./videos/${fileName}.mp4`;
                
                await mergedVideo.mergeToFile(outputFileName)
                    .on('end', () => {
                        console.log('Merged videos');
                        resolve();
                    })
                    .on('error', (error) => {
                        console.log('mergeVideos() error', error);
                        reject(error);
                    });
            });
        } catch(err){
            throw err;
        }
    }

    //delete file `./videos/${videoId}.mp4`, ${startTime+endTime+videoId}_cutted.mp4`, `./videos/${fileName}.mp4`
    async deleteVideos(videoInfos: VideoInfos[], fileName: string): Promise<any> {
        try{
            const deletePromises = videoInfos.map(async (input) => {
                const { videoId, startTime, endTime } = input;

                fs.unlink(`./videos/${videoId}.mp4`, (err) => {
                    if (err) {
                        console.log('deleteVideos() error', err);
                        throw err;
                    }
                    console.log(`./videos/${videoId}.mp4 was deleted`);
                });

                fs.unlink(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4`, (err) => {
                    if (err) {
                        console.log('deleteVideos() error', err);
                        throw err;
                    }
                    console.log(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4 was deleted`);
                });
            });

            await Promise.all(deletePromises);

            // fs.unlink(`./videos/${fileName}.mp4`, (err) => {
            //     if (err) {
            //         console.log('deleteVideos() error', err);
            //         throw err;
            //     }
            //     console.log(`./videos/${fileName}.mp4 was deleted`);
            // });
            
        } catch(err){
            throw err;
        }
    }



    // private sharedData: any;

    // setSharedData(data: any) {
    //     this.sharedData = data;
    //   }
    
    //   getSharedData() {
    //     return this.sharedData;
    //   }

}

function timeStampToSeconds(timestamp) {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
}
