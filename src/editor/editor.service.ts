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
            const videoInfos: VideoInfos[] = [];
            for(const input of userInputs){
                const { url, startTime, endTime } = input;
                const info = await ytdl.getInfo(url);
                const videoTitle = info.videoDetails.title;
                const videoId = info.videoDetails.videoId;
                const startTimeInSecond = timeStampToSeconds(startTime);
                const endTimeInSecond = timeStampToSeconds(endTime);
                videoInfos.push({url, videoId, videoTitle, startTime: startTimeInSecond, endTime: endTimeInSecond});
            }
            console.log(videoInfos);
            //async download
            const downloadPromises = videoInfos.map(async (info) => {
                await this.downloadVideo(info);
                console.log(info.videoTitle, 'downloaded successfully');
            });
            //await all download
            await Promise.all(downloadPromises);

            //async cut
            const cutPromises = videoInfos.map(async (info: VideoInfos) => {
                await this.cutVideo(info);
                console.log(info.videoTitle + ' video cut successfully');
            });

            //await all cut
            await Promise.all(cutPromises);

            await this.mergeVideos(videoInfos, fileName);

            await this.deleteVideos(videoInfos, fileName);

            return 'success';
        } catch (err) {
            console.log('processVideo() error')
            throw err;
        }
    }


    async downloadVideo(info: VideoInfos): Promise<any> {
        try{
            const{url, videoId, videoTitle, startTime, endTime} = info;
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

    async cutVideo(info: VideoInfos): Promise<any> {
        try{
            const{url, videoId, videoTitle, startTime, endTime} = info;
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
            console.log('mergeVideos() called');
            console.log(fileName);
            return new Promise<void>(async (resolve, reject) => {
                const mergedVideo = await ffmpeg();
                for (const info of videoInfos) {
                    console.log('for loop');
                    const{url, videoId, videoTitle, startTime, endTime} = info;
                    mergedVideo.input(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4`);
                }
                const outputFileName = `./videos/${fileName}.mp4`;
                
                await mergedVideo
                    .on('end', () => {
                        console.log('Merged videos');
                        resolve();
                    })
                    .on('error', (error) => {
                        console.log('mergeVideos() error', error);
                        reject(error);
                    })
                    .mergeToFile(outputFileName);
            });
        } catch(err){
            throw err;
        }
    }

    //delete file `./videos/${videoId}.mp4`, ${startTime+endTime+videoId}_cutted.mp4`, `./videos/${fileName}.mp4`
    async deleteVideos(videoInfos: VideoInfos[], fileName: string): Promise<any> {
        try{
            const deletePromises = videoInfos.map(async (info: VideoInfos) => {
                const{url, videoId, videoTitle, startTime, endTime} = info;

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



    private sharedData: any;

    setSharedData(data: any) {
        this.sharedData = data;
      }
    
      getSharedData() {
        return this.sharedData;
      }

}

function timeStampToSeconds(timestamp) {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
}
