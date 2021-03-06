/*
* @author: Brijesh Bittu<brijeshb42@gmail.com>
*/

ZeroClipboard.config( { swfPath: "/static/js/ZeroClipboard.swf" } );
$(document).ready(function() {

    /*
    * Cache jQuery objects to prevent querying everytime.
    */
    var $urlInput       = $("#url-input"),
        $fileInput      = $("#file-input"),
        $container      = $("#container"),
        $imgHolder      = $(".img-holder"),
        $inputContainer = $(".input-container"),
        $buttons        = $(".dynamic-actions"),
        $preview        = $(".preview-container"),
        $dropper        = $(".dropper"),
        $finalForm      = $(".final-form"),
        $imgWidth       = $("#imgWidth"),
        $imgHeight      = $("#imgHeight"),
        $freeImg        = $(".free-img"),
        $freeWidth      = $("#free-width"),
        $freeHeight      = $("#free-height"),
        imager, $imager, jCrop;

    var urlRegExp =/^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/i;

    /*
    * Maintain the current selection inputs in this object to finally
    * send it to the server directly without worrying about any kind
    * of processing.
    */
    var currentInfo = {};

    /*
    * ZeroClipboard Client. So that we dont have to instantiate it everytime.
    */
    var client = null;

    /*
    * A helper variable to maintain unique ids for each of the `copy` button
    * in the ouput. Otherwise, ZeroClipboard has some problems (or maybe I
    * didn't read its docs clear enough.)
    */
    var idCounter = 1;

    /*
    * The output template. Return html to set for the final output (input box 
    * with genrated URLs and a copy button).
    */
    function urlTemplate(typ, url) {
        // if(typ.toLowerCase() === "thumbnail") {
        //     typ = "Feed";
        // }
        console.log("urltmpl");
        var id = "copy-text-"+idCounter++;
        var $div = $("<div></div>");
        $div.addClass("form-field");
        $div.append("<label>"+typ+"</label>");
        $div.append("<input class='form-control' id='"+id+"' type=text value='"+url+"' />");
        $div.append("<button data-clipboard-text='"+url+"' class='btn btn-warning copy-btn'>Copy</button>");
        return $div;
    }

    /*
    * Set to a string to prompt user before navigating away from the window.
    * null otherwise.
    */
    var winClosing = null;


    function successCb(data) {
        if(data && data.type === "error") {
            mscAlert({
                title: "Error",
                subtitle: data.message || "There was an error."
            });
            return;
        }

        mscAlert({
            title: "Done",
            subtitle: "Images saved."
        });
        var $output = $(".output");
        $output.html('');
        $("#submitter").hide();
        $preview.html('');
        var imgs = data["message"];
        console.log(data);

        for(var key in imgs) {
            if(key.toLowerCase() === "carousel") {
                continue;
            }
            $output.append(urlTemplate(key, imgs[key]));
            //if(imgs[key].indexOf("images/") > -1) {
            //    console.log(urlTemplate(key, imgs[key]));
            //}
        }
        if(imgs.carousel) {
            $output.append(urlTemplate('carousel', imgs['carousel']));
        }
        $output.show();
        client = null;
        client = new ZeroClipboard($(".copy-btn"));

        client.on('ready', function(event) {
            console.log("Client ready");

            client.on('aftercopy', function(event) {
                console.log(event);
                $(event.target).html("Copied").addClass("btn-info");
                console.log('Copied text to clipboard: ' + event.data['text/plain']);
            });
        });

        client.on( 'error', function(event) {
            ZeroClipboard.destroy();
        });
    }

    /*
    * Collect user data (image and dimensions) and send it to the server for manipulation.
    */
    function sendData(src, data) {
        mscAlert({
            title: "Wait",
            subtitle: "This may take a while."
        });
        jCrop.destroy();
        jCrop = null;
        $.ajax({
            url: "/img",
            method: "POST",
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            data: JSON.stringify({img: src, sizes: data}),
            success: successCb,
            error: function() {
                mscAlert("There was an error.");
                winClosing = null;
            }
        });
    }

    /*
    * Genrate preview of selected images on each crop change event.
    */
    var generatePreview = function (e) {
        $preview.html("");
        $finalForm.html("");
        for(var name in currentInfo) {
            var img = currentInfo[name];
            var canvas = document.createElement("canvas");
            var ctx = canvas.getContext("2d");
            canvas.width = img.origWidth;
            canvas.height = img.origHeight;
            ctx.drawImage(
                imager,
                img.x,
                img.y,
                img.width, // * img.naturalAR,
                img.height,
                0,
                0,
                img.origWidth,
                img.origHeight
            );
            $preview.append("<span><b>"+name+"</b></span>");
            $preview.append(canvas);
            var $formField = "<span><label>"+name+"</label>" + "<input type=checkbox checked=true data-img-name='"+name+"' /></span>";
            $finalForm.append($formField);
        }
        $("#submitter").show();
    };
    
    /*
    * Returns a listener (a function) that attaches itself to the relevant Image type button
    * (thumbnail, article, etc).
    * (Too messy internal workings to `document`. Read Jcrop docs to understand.)
    */
    function getListener(name, width, height) {
        // if(name.toLowerCase() === "thumbnail") {
        //     name = "feed";
        // }
        if(name === "preview") {
            return generatePreview;
        }
        return function(e) {
            winClosing = "You have unsaved changes. Are you sure?";
            if(jCrop) {
                jCrop.destroy();
                jCrop = null;
            }
            setTimeout(function() {
                if(name === "free") {
                    $imager.Jcrop({
                        onSelect: function(data) {
                            if($freeWidth.val() !== "" && /^[0-9]*$/.test($freeWidth.val())) {
                                width = parseInt($freeWidth.val());
                                height = data.h / data.w * width;
                                $freeHeight.val(Math.round(height));
                            } else {
                                $freeWidth.val("");
                                $freeHeight.val("");
                                width = data.w * imager.naturalWidth / $imager.width();
                                height = data.h * imager.naturalHeight / $imager.height();
                            }
                            currentInfo[name.toLowerCase()] = {
                                x: data.x * imager.naturalWidth / $imager.width(),
                                y: data.y * imager.naturalHeight / $imager.height(),
                                width: data.w * imager.naturalWidth / $imager.width(),
                                height: data.h * imager.naturalHeight / $imager.height(),
                                origWidth: width,
                                origHeight: height
                            };
                            $imgWidth.html("Width: " + Math.round(data.w * imager.naturalWidth / $imager.width()));
                            $imgHeight.html("Height: " + Math.round(data.h * imager.naturalHeight / $imager.height()));
                            generatePreview();
                        },
                        setSelect: [0, 0, 50, 50]
                    }, function() {
                        jCrop = this;
                    });
                    return;
                }
                $freeWidth.val("");
                $freeHeight.val("");
                $imager.Jcrop({
                    aspectRatio: width/height,
                    onSelect: function(data) {
                        currentInfo[name.toLowerCase()] = {
                            x: data.x * imager.naturalWidth / $imager.width(),
                            y: data.y * imager.naturalHeight / $imager.height(),
                            width: data.w * imager.naturalWidth / $imager.width(),
                            height: data.h * imager.naturalHeight / $imager.height(),
                            origWidth: width,
                            origHeight: height
                        };
                        $imgWidth.html("Width: " + Math.round(data.w * imager.naturalWidth / $imager.width()));
                        $imgHeight.html("Height: " + Math.round(data.h * imager.naturalHeight / $imager.height()));
                        generatePreview();
                    },
                    //minSize: minsize,
                    setSelect: [0, 0, width, height]
                }, function() {
                    jCrop = this;
                });
            }, 200);
            
        };
    }

    /*
    * Reset to default state.
    */
    function reset() {
        $urlInput.val('');
        $fileInput.val('');
        $imgHolder.html('');
        $preview.html('');
        $(".controls").hide();
        $("#submitter").hide();
        currentInfo = {};
        $inputContainer.show();
        winClosing = "";
        $freeImg.hide();
    }
    
    /*
    * Called when image from input URL finishes loading.
    * This generates:
    * - each of the Image type button
    * - attaches listeners.
    * - adds the buttons to the DOM (a specific id)
    */
    function imgOnLoad(e) {
        currentInfo = {};
        winClosing = null;
        $imgHolder.html(imager);
        $buttons.html('');
        $preview.html('');
        if(window.SIZES) {
            var $btn = $("<button />").html("Free").addClass("btn btn-primary img-size-name");
            var listener = getListener("free");
            $btn.on("click", listener);
            $buttons.append($btn);
            var name;
            for(s in SIZES) {
                name = s;
                // if(s.toLowerCase() === "thumbnail") {
                //     name = "feed";
                // }
                var $btn = $("<button />").html(name).addClass("btn btn-danger img-size-name");
                var listener = getListener(s, SIZES[s][0], SIZES[s][1]);
                $btn.on("click", listener);
                $buttons.append($btn);
            }
        }
        $(".controls").show();
        $inputContainer.hide();
        $freeImg.show()
    }

    $fileInput.on("change", function(e) {
        var self = this;
        if(self.files && self.files[0] && self.files[0].type.search("image") > -1) {
            var reader = new FileReader();
            reader.onload = function(e) {
                imager = null;
                imager = new Image();
                //imager.crossOrigin = "Anonymous";
                imager.addEventListener("load", imgOnLoad);
                imager.src = e.target.result;
                $imager = $(imager);
            }
            reader.readAsDataURL(self.files[0]);
        }else {
            mscAlert("Provide a valid image file.");
            $fileInput.val('');
        }
    });


    /*
    * Tries to preload the image when it is present in the queryString
    * (i.e) /?url=http://url.of/yhe/image.jpg
    * This is the same as when user manually inputs image URL ans presses enter.
    */
    function preloadImage(url) {
        if(!urlRegExp.test(url)) {
            alert("Enter a valid URL.");
            return;
        }
        imager = null;
        imager = new Image();
        imager.addEventListener("load", imgOnLoad);
        imager.onerror = function() {
            mscAlert("Error while downloading image. Please download it to your PC and then upload.");
        };
        imager.src = url;
        $urlInput.val(url);
        $imager = $(imager);
    }

    /*
    * Callback attached to input url box to load image from URL.
    */
    function loadFromUrl(e) {
        if(e && e.which !== 13) {
            return;
        }
        if(!urlRegExp.test($urlInput.val())) {
            alert("Enter a valid URL.");
            return;
        }
        imager = null;
        imager = new Image();
        imager.addEventListener("load", imgOnLoad);
        imager.onerror = function() {
            mscAlert("Error while downloading image. Please download it to your PC and then upload.");
        };
        imager.src = $urlInput.val();
        $imager = $(imager);
    }

    $urlInput.on("keydown", loadFromUrl);

    if($urlInput.val() !== "" && location.pathname == "/") {
        loadFromUrl();
    }

    /*$dropper.on("click", function(e) {
        e.stopPropagation();
        e.preventDefault();
        $fileInput.trigger("click");
    });*/

    $dropper.on("dragover", function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(this).addClass("file-hover");
    });
    $dropper.on("dragleave", function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(this).removeClass("file-hover");
    });
    $dropper.on("drop", function(e) {
        e.stopPropagation();
        e.preventDefault();
        e = e.originalEvent;
        var files = e.target.files || e.dataTransfer.files;
        if(!files) {
            mscAlert("Browser not supported.");
        }
        $(this).removeClass("file-hover");
        var imgFound = false;
        for(var i=0; i<files.length; i++) {
            if(files[i].type.search("image") > -1) {
                imgFound = true;
                var reader = new FileReader();
                reader.onload = function(e) {
                    imager = null;
                    imager = new Image();
                    //imager.crossOrigin = "Anonymous";
                    imager.addEventListener("load", imgOnLoad);
                    imager.src = e.target.result;
                    $imager = $(imager);
                }
                reader.readAsDataURL(files[i]);
                break;
            }
        }
        if(!imgFound) {
            mscAlert("Drop valid image files.");
        }
    });
    
    /*
    * Save button event.
    * Aggregates user inputs (i.e currentInfo), and sends it to the server
    */
    $("#finalSave").on("click", function() {
        var data = {};
        $("[data-img-name]").each(function() {
            var nm = $(this).data("img-name");
            if($(this).prop('checked')) {
                data[nm] = currentInfo[nm];
            }
        });
        if($.isEmptyObject(data)) {
            mscAlert("You did not select anything.");
        }else {
            sendData(imager.src, data);
            //console.log(data);
        }
    });

    //$freeWidth.on("input", generatePreview);

    window.onbeforeunload = confirmExit;
    function confirmExit() {
        return winClosing;
    }
});
