package com.englishlearning.profile.service;

import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;

final class AvatarImage {
    private static final String JPEG_PREFIX = "data:image/jpeg;base64,";
    private static final int MAX_BYTES = 200 * 1024;
    private static final int MAX_SIDE = 320;
    private static final String ERROR = "Avatar must be a JPEG of at most 320 × 320 pixels and 200 KB";

    private AvatarImage() {}

    static void validate(String avatarUrl) {
        if (avatarUrl == null) return;
        if (!avatarUrl.startsWith(JPEG_PREFIX) || avatarUrl.length() > JPEG_PREFIX.length() + 4 * ((MAX_BYTES + 2) / 3)) {
            throw new IllegalArgumentException(ERROR);
        }
        try {
            byte[] image = Base64.getDecoder().decode(avatarUrl.substring(JPEG_PREFIX.length()));
            if (image.length > MAX_BYTES || image.length < 4
                    || image[0] != (byte) 0xff || image[1] != (byte) 0xd8
                    || image[image.length - 2] != (byte) 0xff || image[image.length - 1] != (byte) 0xd9) {
                throw new IllegalArgumentException(ERROR);
            }
            try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(image))) {
                var reader = ImageIO.getImageReadersByFormatName("JPEG").next();
                try {
                    reader.setInput(input);
                    if (reader.getWidth(0) > MAX_SIDE || reader.getHeight(0) > MAX_SIDE || reader.read(0) == null) {
                        throw new IllegalArgumentException(ERROR);
                    }
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException | IllegalArgumentException error) {
            throw new IllegalArgumentException(ERROR);
        }
    }
}
