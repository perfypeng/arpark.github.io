

// const gpu = require("src/gpgpu.js")

let count = 0;

let test = window.GPU;

let canvas = document.getElementById("canvas");
// let ctx = canvas.getContext("webgl");

// let myImage = new Image(360, 640);
// myImage.src = 'images/001_srcImage.jpg';


let sourceimage = document.getElementById('image');

sourceimage.onload = function() {
    copy(); 
    display(); 
}

function loadImage() {
    count++;
    let file = null;
    if(count < 10) {
        file = "images/00" + count + "_srcImage.jpg";
    } else if(count >= 10 && count < 100) {
        file = "images/0" + count + "_srcImage.jpg";
    } else {
        file = "images/" + count + "_srcImage.jpg";
    }
    if(count >= 540) {
        count = 0;
    }
    console.log(file);
    sourceimage.src = file;

    setTimeout(loadImage, 100);
}

loadImage();

let canvas1 = document.getElementById('canvas1');
canvas1.height = canvas1.width = 0;

let context = canvas1.getContext('2d');

function copy() {
    var imgwidth = sourceimage.offsetWidth;
    var imgheight = sourceimage.offsetHeight;
    canvas1.width = imgwidth;
    canvas1.height = imgheight;
    context.drawImage(sourceimage, 0, 0);
}

copy();

function display() {
    imgData = context.getImageData(0, 0, 640, 360);
    // console.log(typeof imgData.data);
    // console.log(imgData.width, " x ", imgData.height);
    let startTime = performance.now();
    test.load(canvas, imgData.data, imgData.width, imgData.height);
    test.gauss(2.0);
    test.rgb2grey();
    test.sobel();
    test.draw();
    let endTime = performance.now();
    console.log("Time: ", endTime - startTime);
}

// display();




